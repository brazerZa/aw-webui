import { defineStore } from 'pinia';
import _ from 'lodash';
import moment from 'moment';

import { getClient } from '~/util/awclient';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { getWorkingDaysInRange, getMonthRange } from '~/util/time';
import { categoryQuery } from '~/queries';

export interface LeaderboardEntry {
  hostname: string;
  totalProductiveSeconds: number;
  totalTrackedSeconds: number;
  workingDays: number;  // Total available workdays (Mon-Fri)
  actualWorkingDays: number;  // Days that met min hours threshold
  availableDays: number;  // Days available after min participation check
  avgProductiveSecondsPerDay: number;
  score: number;  // Calculated based on scoring method
  consistencyScore: number;  // Coefficient of variation (lower = more consistent)
  dailySeconds: number[];  // Productive seconds per worked day (for consistency calc)
}

interface State {
  entries: LeaderboardEntry[];
  excluded: LeaderboardEntry[];  // Have data but don't meet participation threshold
  loading: boolean;
  error: string | null;
  selectedYear: number;
  selectedMonth: number;
}

export const useLeaderboardStore = defineStore('leaderboard', {
  state: (): State => ({
    entries: [],
    excluded: [],
    loading: false,
    error: null,
    selectedYear: moment().year(),
    selectedMonth: moment().month() + 1, // 1-indexed
  }),

  getters: {
    ranked(state: State): LeaderboardEntry[] {
      const settingsStore = useSettingsStore();
      const tiebreak = settingsStore.leaderboard_tiebreak_method || 'total_hours';
      
      // Map tiebreak method to field name
      const tiebreakField: Record<string, string> = {
        total_hours: 'totalProductiveSeconds',
        days_worked: 'actualWorkingDays',
        consistency: 'consistencyScore',
        average_hours: 'avgProductiveSecondsPerDay',
      };
      const tieField = tiebreakField[tiebreak] || 'totalProductiveSeconds';
      
      // Filter out entries that don't meet eligibility
      const eligible = state.entries.filter(e => 
        e.totalProductiveSeconds > 0 && e.availableDays > 0
      );
      
      // Sort by score (desc), then by tiebreak method (desc for consistency: higher = better)
      // Note: for consistency, higher is better (lower CV = more consistent)
      return _.orderBy(eligible, ['score', tieField], ['desc', 'desc']);
    },

    excludedEntries(state: State): LeaderboardEntry[] {
      // Return excluded entries sorted by total productive time (most time first)
      return _.orderBy(state.excluded, ['totalProductiveSeconds'], ['desc']);
    },

    monthLabel(state: State): string {
      return moment({ year: state.selectedYear, month: state.selectedMonth - 1 }).format(
        'MMMM YYYY'
      );
    },

    scoreMethodLabel(): string {
      const settingsStore = useSettingsStore();
      const method = settingsStore.leaderboard_score_method || 'utilisation_score';
      const labels: Record<string, string> = {
        total_hours: 'Total Hours',
        average_hours: 'Average Hours/Day',
        utilisation_score: 'Utilization Score (actual/expected)',
        weighted_hybrid: 'Weighted Hybrid',
      };
      return labels[method] || method;
    },

    standardDailyHours(): number {
      const settingsStore = useSettingsStore();
      return settingsStore.leaderboard_standard_daily_hours || 8;
    },

    minParticipation(): number {
      const settingsStore = useSettingsStore();
      return settingsStore.leaderboard_min_participation_percent || 80;
    },
  },

  actions: {
    setMonth(year: number, month: number) {
      this.selectedYear = year;
      this.selectedMonth = month;
    },

    prevMonth() {
      const m = moment({
        year: this.selectedYear,
        month: this.selectedMonth - 1,
      }).subtract(1, 'month');
      this.selectedYear = m.year();
      this.selectedMonth = m.month() + 1;
    },

    nextMonth() {
      const m = moment({
        year: this.selectedYear,
        month: this.selectedMonth - 1,
      }).add(1, 'month');
      // Don't go past current month
      const now = moment();
      if (m.isAfter(now, 'month')) return;
      this.selectedYear = m.year();
      this.selectedMonth = m.month() + 1;
    },

    async fetchLeaderboard() {
      this.loading = true;
      this.error = null;
      this.entries = [];

      const DBG = '[Leaderboard]';

      try {
        const bucketsStore = useBucketsStore();
        const categoryStore = useCategoryStore();
        const settingsStore = useSettingsStore();

        // Ensure settings are loaded from the server BEFORE loading categories,
        // otherwise categoryStore.load() falls back to default categories
        // instead of the Malachi server categories (with correct scores).
        console.log(`${DBG} Step 1: Loading settings...`);
        await settingsStore.ensureLoaded();
        console.log(`${DBG} Settings loaded:`, {
          _loaded: settingsStore._loaded,
          classesCount: settingsStore.classes?.length,
          classesFirst3: settingsStore.classes?.slice(0, 3).map(c => ({
            name: c.name,
            ruleType: c.rule?.type,
            score: c.data?.score,
          })),
        });

        console.log(`${DBG} Step 2: Loading buckets...`);
        await bucketsStore.ensureLoaded();
        console.log(`${DBG} Buckets loaded:`, {
          totalBuckets: bucketsStore.buckets?.length,
          sampleBuckets: bucketsStore.buckets?.slice(0, 5).map(b => ({
            id: b.id,
            type: b.type,
            hostname: b.hostname,
          })),
        });
        console.log(`${DBG} Hosts discovered:`, bucketsStore.hosts);

        console.log(`${DBG} Step 3: Loading categories...`);
        await categoryStore.load();
        console.log(`${DBG} Categories loaded:`, {
          classesCount: categoryStore.classes?.length,
          classesForQueryCount: categoryStore.classes_for_query?.length,
          classesFirst5: categoryStore.classes?.slice(0, 5).map(c => ({
            name: c.name,
            ruleType: c.rule?.type,
            regex: c.rule?.regex?.substring(0, 50),
            score: c.data?.score,
          })),
          classesForQueryFirst5: categoryStore.classes_for_query?.slice(0, 5).map(([name, rule]) => ({
            name,
            ruleType: rule?.type,
            regex: rule?.regex?.substring(0, 50),
          })),
        });

        const excludedHosts = settingsStore.leaderboard_excluded_hosts || [];
        const hosts = bucketsStore.hosts.filter(h => h && h !== 'unknown' && !excludedHosts.includes(h));
        console.log(`${DBG} Filtered hosts (excluding unknown and excluded: ${excludedHosts.join(', ')}):`, hosts);

        if (hosts.length === 0) {
          console.warn(`${DBG} No hosts found! Leaderboard will be empty.`);
          console.warn(`${DBG} All bucket hostnames:`, bucketsStore.buckets?.map(b => b.hostname));
        }

        const [monthStart, monthEnd] = getMonthRange(this.selectedYear, this.selectedMonth);
        const workingDays = getWorkingDaysInRange(monthStart, monthEnd);

        const timeperiodStr =
          monthStart.format() + '/' + monthEnd.clone().add(1, 'day').startOf('day').format();
        console.log(`${DBG} Time range:`, { timeperiodStr, workingDays, monthStart: monthStart.format(), monthEnd: monthEnd.format() });

        // Query each host in parallel
        const promises = hosts.map(async (hostname): Promise<LeaderboardEntry | null> => {
          try {
            const avail = bucketsStore.available(hostname);
            console.log(`${DBG} [${hostname}] Availability:`, avail);

            if (!avail.window) {
              console.warn(`${DBG} [${hostname}] No window data available, skipping`);
              return null;
            }

            const bid_window = bucketsStore.bucketsWindow(hostname);
            const bid_afk = bucketsStore.bucketsAFK(hostname);
            console.log(`${DBG} [${hostname}] Buckets:`, { bid_window, bid_afk });

            if (bid_window.length === 0 || bid_afk.length === 0) {
              console.warn(`${DBG} [${hostname}] Missing window or AFK bucket, skipping`);
              return null;
            }

            const categories = categoryStore.classes_for_query;
            console.log(`${DBG} [${hostname}] Categories for query: ${categories.length} rules`);

            // Get the leave threshold from settings (default 3 hours)
            const minDailyHours = settingsStore.leaderboard_min_daily_hours || 3;
            const minDailySeconds = minDailyHours * 3600;

            const query = categoryQuery({
              bid_window: bid_window[0],
              bid_afk: bid_afk[0],
              filter_afk: true,
              categories: categories,
              filter_categories: undefined,
            });
            console.log(`${DBG} [${hostname}] Query:`, query);

            const result = await getClient().query([timeperiodStr], query);
            console.log(`${DBG} [${hostname}] Raw result keys:`, result ? Object.keys(result[0] || {}) : 'null');
            console.log(`${DBG} [${hostname}] cat_events count:`, result?.[0]?.cat_events?.length ?? 'N/A');

            if (!result || !result[0] || !result[0].cat_events) {
              console.warn(`${DBG} [${hostname}] No cat_events in result, skipping. Result:`, result);
              return null;
            }

            const catEvents = result[0].cat_events;

            // Calculate productive time: sum durations of categories with positive score
            let totalProductiveSeconds = 0;
            let totalTrackedSeconds = 0;

            // Log first 10 events for debugging
            const debugEvents = catEvents.slice(0, 10);
            console.log(`${DBG} [${hostname}] First ${debugEvents.length} cat_events:`);
            for (const event of debugEvents) {
              const categoryName = event.data?.$category || ['Uncategorized'];
              const score = categoryStore.get_category_score(categoryName);
              console.log(`${DBG}   cat=${JSON.stringify(categoryName)} score=${score} duration=${event.duration}s`);
            }

            // Calculate total tracked and productive from categories
            // Also group by date for daily cap application
            const productiveByDate: Record<string, number> = {};
            for (const event of catEvents) {
              const categoryName = event.data?.$category || ['Uncategorized'];
              const score = categoryStore.get_category_score(categoryName);
              totalTrackedSeconds += event.duration;
              if (score > 0) {
                totalProductiveSeconds += event.duration;
                // Track productive time by date
                const date = new Date(event.timestamp).toISOString().split('T')[0];
                if (!productiveByDate[date]) productiveByDate[date] = 0;
                productiveByDate[date] += event.duration;
              }
            }

            // Apply daily hour cap if configured
            const maxHoursPerDay = settingsStore.leaderboard_max_hours_per_day || 0;
            if (maxHoursPerDay > 0) {
              const maxSecondsPerDay = maxHoursPerDay * 3600;
              let cappedTotal = 0;
              for (const date in productiveByDate) {
                cappedTotal += Math.min(productiveByDate[date], maxSecondsPerDay);
              }
              totalProductiveSeconds = cappedTotal;
            }

            // Calculate actual working days by fetching raw events and grouping by date in JS
            // This is needed because $date doesn't exist in AW events
            const rawQuery = [
              `events = flood(query_bucket("${bid_window[0]}"));`,
              `not_afk = flood(query_bucket("${bid_afk[0]}"));`,
              `not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);`,
              `events = filter_period_intersect(events, not_afk);`,
              `RETURN = { "events": events };`,
            ];
            const rawResult = await getClient().query([timeperiodStr], rawQuery);
            const rawEvents = rawResult?.[0]?.events || [];
            
            // Group events by date and calculate daily totals
            const eventsByDate: Record<string, number> = {};
            for (const ev of rawEvents) {
              const date = new Date(ev.timestamp).toISOString().split('T')[0]; // "2026-03-01"
              if (!eventsByDate[date]) eventsByDate[date] = 0;
              eventsByDate[date] += ev.duration;
            }
            
            // Count days where total duration >= threshold
            let actualWorkingDays = 0;
            for (const date in eventsByDate) {
              if (eventsByDate[date] >= minDailySeconds) {
                actualWorkingDays++;
              }
            }
            console.log(`${DBG} [${hostname}] Daily totals:`, eventsByDate);
            console.log(`${DBG} [${hostname}] Actual working days (>= ${minDailyHours}h):`, actualWorkingDays);

            // Calculate score based on scoring method
            const scoreMethod = settingsStore.leaderboard_score_method || 'utilisation_score';
            const standardDailySeconds = (settingsStore.leaderboard_standard_daily_hours || 8) * 3600;
            const minParticipation = (settingsStore.leaderboard_min_participation_percent || 80) / 100;

            // Calculate available days (for participation check)
            const availableDays = Math.floor(workingDays * minParticipation);
            const meetsParticipation = actualWorkingDays >= availableDays;

            let score = 0;
            let finalTotalSeconds = totalProductiveSeconds;

            if (!meetsParticipation) {
              // Doesn't meet minimum participation - score is 0 (will be filtered out)
              score = 0;
            } else if (scoreMethod === 'total_hours') {
              score = finalTotalSeconds;
            } else if (scoreMethod === 'average_hours') {
              // Average hours per worked day
              score = actualWorkingDays > 0 ? finalTotalSeconds / actualWorkingDays : 0;
            } else if (scoreMethod === 'utilisation_score') {
              // Utilisation: actual / expected
              const expectedSeconds = workingDays * standardDailySeconds;
              score = expectedSeconds > 0 ? finalTotalSeconds / expectedSeconds : 0;
            } else if (scoreMethod === 'weighted_hybrid') {
              const utilisationWeight = settingsStore.leaderboard_utilisation_weight || 0.7;
              const averageWeight = settingsStore.leaderboard_average_weight || 0.3;
              const expectedSeconds = workingDays * standardDailySeconds;
              const utilisation = expectedSeconds > 0 ? finalTotalSeconds / expectedSeconds : 0;
              const average = actualWorkingDays > 0 ? finalTotalSeconds / actualWorkingDays : 0;
              score = (utilisation * utilisationWeight) + (average * averageWeight);
            } else {
              // Default to utilisation score
              const expectedSeconds = workingDays * standardDailySeconds;
              score = expectedSeconds > 0 ? finalTotalSeconds / expectedSeconds : 0;
            }

            console.log(`${DBG} [${hostname}] Score:`, {
              scoreMethod,
              score: score.toFixed(4),
              finalTotalHours: (finalTotalSeconds / 3600).toFixed(2),
              meetsParticipation,
            });

            // Use actualWorkingDays for average (if > 0), otherwise fall back to workingDays
            const daysForAverage = actualWorkingDays > 0 ? actualWorkingDays : workingDays;
            const avgProductiveSecondsPerDay =
              daysForAverage > 0 ? finalTotalSeconds / daysForAverage : 0;

            // Calculate consistency score (coefficient of variation)
            // Use capped productive time if max hours per day is set
            const dailySeconds: number[] = [];
            const maxSecondsPerDay = (settingsStore.leaderboard_max_hours_per_day || 0) * 3600;
            for (const date in productiveByDate) {
              if (productiveByDate[date] >= minDailySeconds) {
                const dailyValue = maxSecondsPerDay > 0 
                  ? Math.min(productiveByDate[date], maxSecondsPerDay)
                  : productiveByDate[date];
                dailySeconds.push(dailyValue);
              }
            }
            
            let consistencyScore = 0;
            if (dailySeconds.length >= 2) {
              const mean = dailySeconds.reduce((a, b) => a + b, 0) / dailySeconds.length;
              const variance = dailySeconds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailySeconds.length;
              const stdDev = Math.sqrt(variance);
              consistencyScore = mean > 0 ? stdDev / mean : 0;
            }
            // For consistency, lower CV is better. We'll store it as-is (0 = perfectly consistent)
            // When sorting, higher consistencyScore wins (since we're using it for tiebreak and lower CV = better)
            // Actually, let's invert it so higher = better (more consistent)
            consistencyScore = 1 - consistencyScore; // Now 1 = perfectly consistent, 0 = very inconsistent

            return {
              hostname,
              totalProductiveSeconds: finalTotalSeconds,
              totalTrackedSeconds,
              workingDays,
              actualWorkingDays,
              availableDays: availableDays,
              avgProductiveSecondsPerDay,
              score,
              consistencyScore,
              dailySeconds,
            };
          } catch (err) {
            console.warn(`${DBG} [${hostname}] FAILED:`, err);
            return null;
          }
        });

        // Use Promise.allSettled to handle individual host failures gracefully
        const resultsRaw = await Promise.allSettled(promises);
        
        // Collect successful results and log failed hosts
        const results: (LeaderboardEntry | null)[] = [];
        const failedHosts: string[] = [];
        
        for (let i = 0; i < resultsRaw.length; i++) {
          const result = resultsRaw[i];
          const hostname = hosts[i];
          
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.warn(`${DBG} [${hostname}] Promise rejected:`, result.reason);
            failedHosts.push(hostname);
            results.push(null);
          }
        }
        
        if (failedHosts.length > 0) {
          console.warn(`${DBG} Failed hosts (showing partial results):`, failedHosts);
          this.error = `Partial results: ${failedHosts.length} host(s) failed to load: ${failedHosts.join(', ')}`;
        }
        
        console.log(`${DBG} All host results:`, results);

        // Separate entries into eligible (score > 0) and excluded (have data but score = 0)
        const allEntries = results.filter(
          (entry): entry is LeaderboardEntry => entry !== null
        );
        
        this.entries = allEntries.filter(entry => entry.score > 0);
        this.excluded = allEntries.filter(entry => entry.score === 0 && entry.totalProductiveSeconds > 0);
        
        console.log(`${DBG} Eligible entries (score > 0):`, this.entries);
        console.log(`${DBG} Excluded entries (score = 0):`, this.excluded);
      } catch (err) {
        console.error(`${DBG} FATAL ERROR:`, err);
        this.error = 'Failed to load leaderboard data. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    displayConsistency(entry: LeaderboardEntry): string {
      if (!entry || !entry.consistencyScore) return 'N/A';
      const pct = Math.round(entry.consistencyScore * 100);
      if (pct >= 90) return `${pct}% - Very Consistent`;
      if (pct >= 75) return `${pct}% - Consistent`;
      if (pct >= 50) return `${pct}% - Moderate`;
      return `${pct}% - Inconsistent`;
    },
  },
});
