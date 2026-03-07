<template lang="pug">
div
  h5 Leaderboard Settings

  // Section 1: Scoring Method
  div.mb-4
    label Scoring Method
    b-form-select(v-model="scoreMethod" size="sm")
      option(value="total_hours") Total Hours - Simple sum of all productive hours
      option(value="average_hours") Average Hours - Total hours divided by days worked
      option(value="utilisation_score") Utilisation Score - Hours vs expected (fair for leave) ⭐
      option(value="weighted_hybrid") Weighted Hybrid - Combination of utilisation and average
    small.text-muted.d-block How scores are calculated for ranking

  // Section 2: Formula Inputs
  div.mb-4
    h6 Formula Settings
    
    div.row
      div.col-md-6.mb-2
        label Standard Daily Hours
        b-form-input(type="number" v-model.number="standardDailyHours" min="1" max="24" step="0.5" size="sm")
        small.text-muted Expected hours per workday (e.g., 8)
        
      div.col-md-6.mb-2
        label Max Hours Per Day (0 = no cap)
        b-form-input(type="number" v-model.number="maxHoursPerDay" min="0" max="24" step="0.5" size="sm")
        small.text-muted Cap hours per day (0 = unlimited)

    div.row
      div.col-md-6.mb-2
        label Min Participation %
        b-form-input(type="number" v-model.number="minParticipation" min="0" max="100" size="sm")
        small.text-muted Must work this % of available days
        
      div.col-md-6.mb-2
        label Tie-Break Method
        b-form-select(v-model="tiebreakMethod" size="sm")
          option(value="total_hours") Total Hours
          option(value="days_worked") Days Worked

    // Weighted hybrid options
    div(v-if="scoreMethod === 'weighted_hybrid'").mt-3
      h6 Weights
      div.row
        div.col-md-6.mb-2
          label Utilisation Weight (%)
          b-form-input(type="number" v-model.number="utilisationWeight" min="0" max="100" size="sm")
        div.col-md-6.mb-2
          label Average Weight (%)
          b-form-input(type="number" v-model.number="averageWeight" min="0" max="100" size="sm")
      small.text-muted Weights must add to 100%

  // Section 3: Live Formula Preview
  div.mb-4
    h6 Formula Preview
    div.alert.alert-info
      div(v-if="scoreMethod === 'total_hours'")
        strong Score = Total Productive Hours
        div.text-muted Sum of all productive hours worked
      div(v-else-if="scoreMethod === 'average_hours'")
        strong Score = Total Hours ÷ Days Worked
        div.text-muted Average hours per worked day
      div(v-else-if="scoreMethod === 'utilisation_score'")
        strong Score = Total Hours ÷ (Available Days × {{ standardDailyHours }}h)
        div.text-muted Actual hours vs expected hours (fair for leave)
      div(v-else-if="scoreMethod === 'weighted_hybrid'")
        strong Score = (Utilisation × {{ utilisationWeight/100 }}) + (Average × {{ averageWeight/100 }})
        div.text-muted Hybrid of utilisation and average

  // Section 4: Excluded Hosts (keep existing)
  div.mb-4
    h6 Excluded Hosts
    div.mt-2
      span.badge.m-1(
        v-for="h in sortedHostnames",
        :key="h",
        :class="isExcluded(h) ? 'badge-danger' : 'badge-success'",
        @click="toggleExclude(h)",
        style="cursor: pointer; font-size: 0.9rem; padding: 0.5em;"
      ) 
        icon(:name="isExcluded(h) ? 'times' : 'check'")
        | {{ h }}
    small.text-muted.d-block.mt-2 Red = excluded, Green = included
    div(v-if="excludedHosts.length > 0").mt-1
      small.text-muted Currently excluded: 
      span.text-danger {{ excludedHosts.join(', ') }}

  // Section 5: Minimum Daily Hours (keep existing)
  div.mb-4
    h6 Minimum Hours Per Day
    b-form-input(type="number" v-model.number="minDailyHours" min="0" max="24" step="0.5" size="sm" style="max-width: 200px")
    small.text-muted Days with less than this don't count as worked days (default: 3)
</template>

<script lang="ts">
import 'vue-awesome/icons/check';
import 'vue-awesome/icons/times';

import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'LeaderboardSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
      bucketsStore: useBucketsStore(),
    };
  },
  computed: {
    scoreMethod: {
      get(): string {
        return this.settingsStore.leaderboard_score_method || 'utilisation_score';
      },
      set(val: string) {
        this.settingsStore.update({ leaderboard_score_method: val });
      },
    },
    standardDailyHours: {
      get(): number {
        return this.settingsStore.leaderboard_standard_daily_hours || 8;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_standard_daily_hours: val });
      },
    },
    maxHoursPerDay: {
      get(): number {
        return this.settingsStore.leaderboard_max_hours_per_day || 0;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_max_hours_per_day: val });
      },
    },
    minParticipation: {
      get(): number {
        return this.settingsStore.leaderboard_min_participation_percent || 80;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_min_participation_percent: val });
      },
    },
    tiebreakMethod: {
      get(): string {
        return this.settingsStore.leaderboard_tiebreak_method || 'total_hours';
      },
      set(val: string) {
        this.settingsStore.update({ leaderboard_tiebreak_method: val });
      },
    },
    utilisationWeight: {
      get(): number {
        return (this.settingsStore.leaderboard_utilisation_weight || 0.7) * 100;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_utilisation_weight: val / 100 });
      },
    },
    averageWeight: {
      get(): number {
        return (this.settingsStore.leaderboard_average_weight || 0.3) * 100;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_average_weight: val / 100 });
      },
    },
    minDailyHours: {
      get(): number {
        return this.settingsStore.leaderboard_min_daily_hours || 3;
      },
      set(val: number) {
        this.settingsStore.update({ leaderboard_min_daily_hours: val });
      },
    },
    excludedHosts(): string[] {
      return this.settingsStore.leaderboard_excluded_hosts || [];
    },
    sortedHostnames(): string[] {
      const hosts = this.bucketsStore.hosts || [];
      return hosts.filter(h => h && h !== 'unknown').sort();
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
  },
  methods: {
    isExcluded(hostname: string): boolean {
      return this.excludedHosts.includes(hostname);
    },
    toggleExclude(hostname: string) {
      let newExcluded = [...this.excludedHosts];
      const idx = newExcluded.indexOf(hostname);
      if (idx >= 0) {
        newExcluded.splice(idx, 1);
      } else {
        newExcluded.push(hostname);
      }
      this.settingsStore.update({ leaderboard_excluded_hosts: newExcluded });
    },
  },
};
</script>
