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
          option(value="consistency") Consistency (steady hours)
          option(value="average_hours") Average Hours/Day

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

  // Section 3: Live Formula Preview (enhanced with calculations)
  div.mb-4
    h6 Formula Preview
    div.alert.alert-info
      div(v-if="scoreMethod === 'total_hours'")
        strong Score = Total Productive Hours
        div.text-muted Example: 150h → Score: 150
      div(v-else-if="scoreMethod === 'average_hours'")
        strong Score = Total Hours ÷ Days Worked
        div.text-muted Example: 150h ÷ 18 days → Score: 8.33
      div(v-else-if="scoreMethod === 'utilisation_score'")
        strong Score = Total Hours ÷ (Available Days × {{ standardDailyHours }}h)
        div.text-muted Example: 140h ÷ ({{ sampleAvailable }} days × {{ standardDailyHours }}h) = {{ sampleUtilisationScore }}
      div(v-else-if="scoreMethod === 'weighted_hybrid'")
        strong Score = (Utilisation × {{ utilisationWeight/100 }}) + (Average × {{ averageWeight/100 }})
        div.text-muted Hybrid of utilisation and average

  // Section 4: Live Preview Examples
  div.mb-4
    h6 Live Preview Examples
    div.card
      div.card-header Examples demonstrate how scoring works with current settings
      div.card-body
        // Example A: Leave Fairness
        div.mb-4
          h6 Example A: Leave Fairness
          table.table.table-sm
            thead
              tr
                th Employee
                th Available Days
                th Worked Days
                th Total Hours
                th Score
                th Eligible?
            tbody
              tr(:class="exampleAWinner >= minEligible ? 'table-success' : 'table-warning'")
                td Employee A
                td {{ exampleAAvailable }}
                td {{ exampleAAvailable }}
                td {{ exampleATotal }}h
                td {{ exampleAScore }}
                td {{ exampleAAvailable >= minEligible ? '✓' : '✗' }}
              tr(:class="exampleBInner >= minEligible ? 'table-success' : 'table-warning'")
                td Employee B
                td {{ exampleBAvailable }}
                td {{ exampleBAvailable - exampleBLeave }}
                td {{ exampleBTotal }}h
                td {{ exampleBScore }}
                td {{ exampleBAvailable >= minEligible ? '✓' : '✗' }}
          div.font-weight-bold Winner with current settings: 
            span.text-success {{ exampleBScore > exampleAScore ? 'Employee B ✓' : 'Employee A ✓' }}
          small.text-muted Employee B wins despite fewer total hours because leave is factored in

        // Example B: Short Month
        div
          h6 Example B: Short Month / Part-time
          table.table.table-sm
            thead
              tr
                th Employee
                th Available Days
                th Worked Days
                th Total Hours
                th Score
                th Eligible?
            tbody
              tr(:class="exampleCInner >= minEligible ? 'table-success' : 'table-warning'")
                td Employee C
                td {{ exampleCAvailable }}
                td {{ exampleCAvailable }}
                td {{ exampleCTotal }}h
                td {{ exampleCScore }}
                td {{ exampleCAvailable >= minEligible ? '✓' : '✗' }}
              tr(:class="exampleDInner >= minEligible ? 'table-success' : 'table-warning'")
                td Employee D
                td {{ exampleDAvailable }}
                td {{ exampleDAvailable }}
                td {{ exampleDTotal }}h
                td {{ exampleDScore }}
                td {{ exampleDAvailable >= minEligible ? '✓' : '✗' }}
          div.font-weight-bold Winner with current settings: 
            span.text-success {{ exampleCScore > exampleDScore ? 'Employee C ✓' : 'Employee D ✓' }}
          small.text-muted Employee C scores higher but may not be eligible if min participation = {{ minParticipation }}%

  // Section 5: Custom Scenario
  div.mb-4
    h6 
      | Custom Scenario 
      b-btn.ml-2(size="sm" variant="outline-secondary" @click="showCustom = !showCustom") {{ showCustom ? 'Hide' : 'Show' }}
    
    div(v-if="showCustom").card.mt-2
      div.card-body
        div.row
          div.col-md-3.mb-2
            label Available Days
            b-form-input(type="number" v-model.number="customAvailable" min="1" max="31" size="sm")
          div.col-md-3.mb-2
            label Worked Days
            b-form-input(type="number" v-model.number="customWorked" min="0" :max="customAvailable" size="sm")
          div.col-md-3.mb-2
            label Total Hours
            b-form-input(type="number" v-model.number="customTotal" min="0" size="sm")
        div.mt-2
          strong Calculated Score: 
            span.text-success.font-weight-bold.ml-2 {{ customScore }}
        div.text-muted.small {{ customExplanation }}

  // Section 5b: Tiebreak Explanation
  div.mb-4
    h6 Tie-Break Explanation
    div.alert.alert-secondary
      div(v-if="tiebreakMethod === 'total_hours'")
        strong Total Hours: 
        | When scores are equal, the employee with more total hours wins.
      div(v-else-if="tiebreakMethod === 'days_worked'")
        strong Days Worked: 
        | When scores are equal, the employee who worked more days wins.
      div(v-else-if="tiebreakMethod === 'consistency'")
        strong Consistency: 
        | When scores are equal, the employee with steadier daily hours wins (lower variation = higher consistency score).
      div(v-else-if="tiebreakMethod === 'average_hours'")
        strong Average Hours/Day: 
        | When scores are equal, the employee with higher daily average wins.

  // Section 6: Excluded Hosts
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

  // Section 7: Minimum Daily Hours
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
      showCustom: false,
      // Custom scenario values
      customAvailable: 20,
      customWorked: 18,
      customTotal: 140,
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
    
    // Example calculations
    minEligible(): number {
      return Math.floor((this.minParticipation / 100) * 20);
    },
    
    // Example A: Leave Fairness (20 days, 0 leave vs 20 days, 2 leave)
    exampleAAvailable(): number { return 20; },
    exampleATotal(): number { return 150; },
    exampleAWorked(): number { return 20; },
    exampleAWinner(): number { return 20; },
    exampleAScore(): string {
      if (this.scoreMethod === 'total_hours') return '150';
      if (this.scoreMethod === 'average_hours') return '7.50';
      if (this.scoreMethod === 'utilisation_score') return (150 / (20 * this.standardDailyHours)).toFixed(2);
      if (this.scoreMethod === 'weighted_hybrid') {
        const util = 150 / (20 * this.standardDailyHours);
        const avg = 150 / 20;
        return ((util * this.utilisationWeight/100) + (avg * this.averageWeight/100)).toFixed(2);
      }
      return '0';
    },
    
    exampleBAvailable(): number { return 20; },
    exampleBLeave(): number { return 2; },
    exampleBTotal(): number { return 140; },
    exampleBWorked(): number { return 18; },
    exampleBInner(): number { return 18; },
    exampleBScore(): string {
      if (this.scoreMethod === 'total_hours') return '140';
      if (this.scoreMethod === 'average_hours') return '7.78';
      if (this.scoreMethod === 'utilisation_score') return (140 / (20 * this.standardDailyHours)).toFixed(2);
      if (this.scoreMethod === 'weighted_hybrid') {
        const util = 140 / (20 * this.standardDailyHours);
        const avg = 140 / 18;
        return ((util * this.utilisationWeight/100) + (avg * this.averageWeight/100)).toFixed(2);
      }
      return '0';
    },
    
    // Example B: Short Month (10 days vs 20 days)
    exampleCAvailable(): number { return 10; },
    exampleCTotal(): number { return 82; },
    exampleCWorked(): number { return 10; },
    exampleCInner(): number { return 10; },
    exampleCScore(): string {
      if (this.scoreMethod === 'total_hours') return '82';
      if (this.scoreMethod === 'average_hours') return '8.20';
      if (this.scoreMethod === 'utilisation_score') return (82 / (10 * this.standardDailyHours)).toFixed(2);
      if (this.scoreMethod === 'weighted_hybrid') {
        const util = 82 / (10 * this.standardDailyHours);
        const avg = 82 / 10;
        return ((util * this.utilisationWeight/100) + (avg * this.averageWeight/100)).toFixed(2);
      }
      return '0';
    },
    
    exampleDAvailable(): number { return 20; },
    exampleDTotal(): number { return 150; },
    exampleDWorked(): number { return 20; },
    exampleDInner(): number { return 20; },
    exampleDScore(): string {
      if (this.scoreMethod === 'total_hours') return '150';
      if (this.scoreMethod === 'average_hours') return '7.50';
      if (this.scoreMethod === 'utilisation_score') return (150 / (20 * this.standardDailyHours)).toFixed(2);
      if (this.scoreMethod === 'weighted_hybrid') {
        const util = 150 / (20 * this.standardDailyHours);
        const avg = 150 / 20;
        return ((util * this.utilisationWeight/100) + (avg * this.averageWeight/100)).toFixed(2);
      }
      return '0';
    },
    
    // Sample utilisation score for preview
    sampleAvailable(): number { return 18; },
    sampleUtilisationScore(): string {
      return (this.standardDailyHours * 18 * 0.9 / (18 * this.standardDailyHours)).toFixed(2);
    },
    
    // Custom scenario calculations
    customScore(): string {
      const worked = Math.min(this.customWorked, this.customAvailable);
      if (this.scoreMethod === 'total_hours') return this.customTotal.toString();
      if (this.scoreMethod === 'average_hours') return worked > 0 ? (this.customTotal / worked).toFixed(2) : '0';
      if (this.scoreMethod === 'utilisation_score') {
        const expected = this.customAvailable * this.standardDailyHours;
        return expected > 0 ? (this.customTotal / expected).toFixed(2) : '0';
      }
      if (this.scoreMethod === 'weighted_hybrid') {
        const util = (this.customAvailable * this.standardDailyHours) > 0 
          ? this.customTotal / (this.customAvailable * this.standardDailyHours) : 0;
        const avg = worked > 0 ? this.customTotal / worked : 0;
        return ((util * this.utilisationWeight/100) + (avg * this.averageWeight/100)).toFixed(2);
      }
      return '0';
    },
    customExplanation(): string {
      if (this.scoreMethod === 'total_hours') return `Total hours: ${this.customTotal}h`;
      if (this.scoreMethod === 'average_hours') return `${this.customTotal}h ÷ ${Math.min(this.customWorked, this.customAvailable)} days = ${this.customScore}`;
      if (this.scoreMethod === 'utilisation_score') return `${this.customTotal}h ÷ (${this.customAvailable} × ${this.standardDailyHours}h) = ${this.customScore}`;
      return `Hybrid calculation: ${this.customScore}`;
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
