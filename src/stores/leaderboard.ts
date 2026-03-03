import { defineStore } from 'pinia';
import _ from 'lodash';
import moment from 'moment';

import { getClient } from '~/util/awclient';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { getWorkingDaysInRange, getMonthRange } from '~/util/time';
import { categoryQuery } from '~/queries';

export interface LeaderboardEntry {
  hostname: string;
  totalProductiveSeconds: number;
  totalTrackedSeconds: number;
  workingDays: number;
  avgProductiveSecondsPerDay: number;
}

interface State {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  selectedYear: number;
  selectedMonth: number;
}

export const useLeaderboardStore = defineStore('leaderboard', {
  state: (): State => ({
    entries: [],
    loading: false,
    error: null,
    selectedYear: moment().year(),
    selectedMonth: moment().month() + 1, // 1-indexed
  }),

  getters: {
    ranked(state: State): LeaderboardEntry[] {
      return _.orderBy(
        state.entries.filter(e => e.totalProductiveSeconds > 0),
        ['totalProductiveSeconds'],
        ['desc']
      );
    },

    monthLabel(state: State): string {
      return moment({ year: state.selectedYear, month: state.selectedMonth - 1 }).format(
        'MMMM YYYY'
      );
    },
  },

  actions: {
    setMonth(year: number, month: number) {
      this.selectedYear = year;
      this.selectedMonth = month;
    },

    prevMonth() {
      const m = moment({ year: this.selectedYear, month: this.selectedMonth - 1 }).subtract(
        1,
        'month'
      );
      this.selectedYear = m.year();
      this.selectedMonth = m.month() + 1;
    },

    nextMonth() {
      const m = moment({ year: this.selectedYear, month: this.selectedMonth - 1 }).add(
        1,
        'month'
      );
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

      try {
        const bucketsStore = useBucketsStore();
        const categoryStore = useCategoryStore();

        await bucketsStore.ensureLoaded();
        await categoryStore.load();

        const hosts = bucketsStore.hosts.filter(h => h && h !== 'unknown');

        const [monthStart, monthEnd] = getMonthRange(this.selectedYear, this.selectedMonth);
        const workingDays = getWorkingDaysInRange(monthStart, monthEnd);

        const timeperiodStr =
          monthStart.format() + '/' + monthEnd.clone().add(1, 'day').startOf('day').format();

        // Query each host in parallel
        const promises = hosts.map(async (hostname): Promise<LeaderboardEntry | null> => {
          try {
            const avail = bucketsStore.available(hostname);
            if (!avail.window) {
              return null;
            }

            const bid_window = bucketsStore.bucketsWindow(hostname);
            const bid_afk = bucketsStore.bucketsAFK(hostname);

            if (bid_window.length === 0 || bid_afk.length === 0) {
              return null;
            }

            const categories = categoryStore.classes_for_query;

            const query = categoryQuery({
              bid_window: bid_window[0],
              bid_afk: bid_afk[0],
              filter_afk: true,
              categories: categories,
              filter_categories: [],
            });

            const result = await getClient().query([timeperiodStr], query);

            if (!result || !result[0] || !result[0].cat_events) {
              return null;
            }

            const catEvents = result[0].cat_events;

            // Calculate productive time: sum durations of categories with positive score
            let totalProductiveSeconds = 0;
            let totalTrackedSeconds = 0;

            for (const event of catEvents) {
              const categoryName = event.data?.$category || ['Uncategorized'];
              const score = categoryStore.get_category_score(categoryName);
              totalTrackedSeconds += event.duration;
              if (score > 0) {
                totalProductiveSeconds += event.duration;
              }
            }

            const avgProductiveSecondsPerDay =
              workingDays > 0 ? totalProductiveSeconds / workingDays : 0;

            return {
              hostname,
              totalProductiveSeconds,
              totalTrackedSeconds,
              workingDays,
              avgProductiveSecondsPerDay,
            };
          } catch (err) {
            console.warn(`Failed to fetch data for host ${hostname}:`, err);
            return null;
          }
        });

        const results = await Promise.all(promises);
        this.entries = results.filter(
          (entry): entry is LeaderboardEntry =>
            entry !== null && entry.totalProductiveSeconds > 0
        );
      } catch (err) {
        console.error('Failed to fetch leaderboard data:', err);
        this.error = 'Failed to load leaderboard data. Please try again.';
      } finally {
        this.loading = false;
      }
    },
  },
});
