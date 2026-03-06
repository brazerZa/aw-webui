<template lang="pug">
div
  h5 Leaderboard settings

  div.mb-3
    label Minimum daily hours
    b-form-input(
      type="number",
      v-model.number="minDailyHours",
      min="0",
      max="24",
      step="0.5",
      @change="updateMinDailyHours"
    )
    small.text-muted
      | Days with less than this many productive hours won't count towards the average. Default: 3 hours.

  div.mb-3
    label Excluded hosts - click to toggle
    div.mt-2
      span.badge.m-1(
        v-for="h in sortedHostnames",
        :key="h",
        :class="isExcluded(h) ? 'badge-danger' : 'badge-success'",
        @click="toggleExclude(h)",
        style="cursor: pointer; font-size: 0.9rem; padding: 0.5em;"
      ) 
        icon(:name="isExcluded(h) ? 'times' : 'check'" size="1")
        | {{ h }}
    small.text-muted.d-block.mt-2
      | Red = excluded from leaderboard, Green = included. Click to toggle.

  div(v-if="excludedHosts.length > 0").mt-2
    small.text-muted Currently excluded: 
    span.text-danger {{ excludedHosts.join(', ') }}
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
    minDailyHours: {
      get(): number {
        return this.settingsStore.leaderboard_min_daily_hours || 3;
      },
      set(val: number) {
        // handled by @change
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
    updateMinDailyHours() {
      this.settingsStore.update({ leaderboard_min_daily_hours: this.minDailyHours });
    },
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
