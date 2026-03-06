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
    label Excluded hosts
    b-form-input(
      v-model="excludedHostsText",
      @change="updateExcludedHosts",
      placeholder="e.g. Hendrik_BBD, Louis-Laptop"
    )
    small.text-muted
      | Comma-separated list of hostnames to exclude from the leaderboard.

  div(v-if="hostnames.length > 0")
    small.text-muted Available hosts: 
    span.badge.badge-secondary.mr-1(v-for="h in hostnames") {{ h }}
</template>

<script lang="ts">
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
    excludedHostsText: {
      get(): string {
        const arr = this.settingsStore.leaderboard_excluded_hosts || [];
        return arr.join(', ');
      },
      set(val: string) {
        // handled by @change
      },
    },
    hostnames() {
      return this.bucketsStore.hosts || [];
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
  },
  methods: {
    updateMinDailyHours() {
      this.settingsStore.update({ leaderboard_min_daily_hours: this.minDailyHours });
    },
    updateExcludedHosts() {
      const hosts = this.excludedHostsText
        .split(',')
        .map((h: string) => h.trim())
        .filter((h: string) => h.length > 0);
      this.settingsStore.update({ leaderboard_excluded_hosts: hosts });
    },
  },
};
</script>
