<template lang="pug">
div
  .aw-container.p-4.mt-4
    .d-flex.align-items-center.justify-content-between.mb-4
      h3.mb-0
        icon.mr-2(name="trophy")
        | Employee of the Month

      .d-flex.align-items-center
        b-btn.mr-2(variant="outline-secondary" size="sm" @click="prevMonth")
          icon(name="chevron-left")
        span.font-weight-bold.mx-2(style="min-width: 150px; text-align: center;")
          | {{ leaderboardStore.monthLabel }}
        b-btn.ml-2(variant="outline-secondary" size="sm" @click="nextMonth" :disabled="isCurrentMonth")
          icon(name="chevron-right")

    .text-muted.mb-3(v-if="workingDaysLabel")
      small
        icon.mr-1(name="calendar-day")
        | {{ workingDaysLabel }}

    div(v-if="leaderboardStore.loading")
      .text-center.py-5
        b-spinner.mb-3(variant="warning" label="Loading...")
        div.text-muted Loading leaderboard data for all employees...

    b-alert(v-if="leaderboardStore.error" variant="danger" show)
      | {{ leaderboardStore.error }}

    div(v-if="!leaderboardStore.loading && ranked.length === 0 && !leaderboardStore.error")
      .text-center.py-5.text-muted
        icon.mb-3(name="trophy" scale="3")
        div No productive activity data found for {{ leaderboardStore.monthLabel }}.
        div.small.mt-1 Make sure employees have categorized their activities with positive scores.

    div(v-if="!leaderboardStore.loading && ranked.length > 0")
      //- Podium for top 3
      .podium.mb-4(v-if="ranked.length >= 1")
        .row.justify-content-center.align-items-end
          .col-md-3.text-center.mb-3(v-if="ranked.length >= 2")
            .podium-card.silver.p-3
              .rank-badge 2
              .hostname.mt-2 {{ ranked[1].hostname }}
              .productive-time.mt-1 {{ formatDuration(ranked[1].totalProductiveSeconds) }}
              .avg-label.mt-1(
                v-b-tooltip.hover.html
                :title="avgTooltip(ranked[1])"
              )
                small.text-muted avg {{ formatDuration(ranked[1].avgProductiveSecondsPerDay) }}/day ({{ ranked[1].actualWorkingDays }} days)

          .col-md-3.text-center.mb-3(v-if="ranked.length >= 1")
            .podium-card.gold.p-3
              .crown-icon
                icon(name="crown" scale="1.5")
              .rank-badge 1
              .hostname.mt-2 {{ ranked[0].hostname }}
              .productive-time.mt-1 {{ formatDuration(ranked[0].totalProductiveSeconds) }}
              .avg-label.mt-1(
                v-b-tooltip.hover.html
                :title="avgTooltip(ranked[0])"
              )
                small.text-muted avg {{ formatDuration(ranked[0].avgProductiveSecondsPerDay) }}/day ({{ ranked[0].actualWorkingDays }} days)

          .col-md-3.text-center.mb-3(v-if="ranked.length >= 3")
            .podium-card.bronze.p-3
              .rank-badge 3
              .hostname.mt-2 {{ ranked[2].hostname }}
              .productive-time.mt-1 {{ formatDuration(ranked[2].totalProductiveSeconds) }}
              .avg-label.mt-1(
                v-b-tooltip.hover.html
                :title="avgTooltip(ranked[2])"
              )
                small.text-muted avg {{ formatDuration(ranked[2].avgProductiveSecondsPerDay) }}/day ({{ ranked[2].actualWorkingDays }} days)

      //- Full table
      .table-responsive
        table.table.table-hover
          thead
            tr
              th.text-center(style="width: 60px;") Rank
              th Employee
              th Total Productive Time
              th.text-center Avg / Day
              th(style="width: 40%;") Progress
          tbody
            tr(v-for="(entry, index) in ranked" :key="entry.hostname" :class="rowClass(index)")
              td.text-center.font-weight-bold
                span(:class="rankClass(index)") {{ index + 1 }}
              td
                .d-flex.align-items-center
                  icon.mr-2(:name="index < 3 ? 'trophy' : 'desktop'" :class="rankClass(index)")
                  span.font-weight-bold {{ entry.hostname }}
              td {{ formatDuration(entry.totalProductiveSeconds) }}
              td.text-center(
                v-b-tooltip.hover.html
                :title="avgTooltip(entry)"
              )
                | {{ formatDuration(entry.avgProductiveSecondsPerDay) }}/day ({{ entry.actualWorkingDays }} days)
              td
                .d-flex.align-items-center
                  b-progress.flex-grow-1(:max="maxProductive" style="height: 20px;")
                    b-progress-bar(
                      :value="entry.totalProductiveSeconds"
                      :class="progressClass(index)"
                    )
                  small.ml-2.text-muted {{ progressPercent(entry) }}%
</template>

<style lang="scss" scoped>
@import '../style/globals';

.podium-card {
  border-radius: 12px;
  border: 2px solid $lightBorderColor;
  position: relative;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }

  .rank-badge {
    display: inline-block;
    width: 36px;
    height: 36px;
    line-height: 36px;
    border-radius: 50%;
    font-weight: bold;
    font-size: 1.2em;
    color: white;
  }

  .hostname {
    font-weight: bold;
    font-size: 1.1em;
  }

  .productive-time {
    font-size: 1.4em;
    font-weight: bold;
  }

  .avg-label {
    cursor: help;
  }
}

.gold {
  border-color: #ffd700;
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%);

  .rank-badge {
    background-color: #ffd700;
    color: #333;
  }

  .crown-icon {
    color: #ffd700;
    margin-bottom: 4px;
  }

  .productive-time {
    color: #b8860b;
  }
}

.silver {
  border-color: #c0c0c0;
  background: linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%);

  .rank-badge {
    background-color: #c0c0c0;
  }

  .productive-time {
    color: #666;
  }
}

.bronze {
  border-color: #cd7f32;
  background: linear-gradient(135deg, #fdf0e8 0%, #f5dcc8 100%);

  .rank-badge {
    background-color: #cd7f32;
  }

  .productive-time {
    color: #8b5a2b;
  }
}

.rank-gold {
  color: #ffd700;
}

.rank-silver {
  color: #c0c0c0;
}

.rank-bronze {
  color: #cd7f32;
}

.row-gold {
  background-color: rgba(255, 215, 0, 0.05);
}

.row-silver {
  background-color: rgba(192, 192, 192, 0.05);
}

.row-bronze {
  background-color: rgba(205, 127, 50, 0.05);
}

.progress-gold ::v-deep .progress-bar {
  background-color: #ffd700;
}

.progress-silver ::v-deep .progress-bar {
  background-color: #c0c0c0;
}

.progress-bronze ::v-deep .progress-bar {
  background-color: #cd7f32;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/trophy';
import 'vue-awesome/icons/crown';
import 'vue-awesome/icons/chevron-left';
import 'vue-awesome/icons/chevron-right';
import 'vue-awesome/icons/calendar-day';
import 'vue-awesome/icons/desktop';

import moment from 'moment';
import { seconds_to_duration, getWorkingDaysInRange, getMonthRange } from '~/util/time';
import { useLeaderboardStore, LeaderboardEntry } from '~/stores/leaderboard';

export default {
  name: 'Leaderboard',

  data() {
    return {
      leaderboardStore: useLeaderboardStore(),
    };
  },

  computed: {
    ranked(): LeaderboardEntry[] {
      return this.leaderboardStore.ranked;
    },

    maxProductive(): number {
      if (this.ranked.length === 0) return 1;
      return this.ranked[0].totalProductiveSeconds;
    },

    isCurrentMonth(): boolean {
      const now = moment();
      return (
        this.leaderboardStore.selectedYear === now.year() &&
        this.leaderboardStore.selectedMonth === now.month() + 1
      );
    },

    workingDaysLabel(): string {
      const store = this.leaderboardStore;
      if (this.ranked.length === 0) return '';
      const [start, end] = getMonthRange(store.selectedYear, store.selectedMonth);
      const days = getWorkingDaysInRange(start, end);
      const totalDaysInMonth = getWorkingDaysInRange(
        start,
        start.clone().endOf('month').startOf('day')
      );

      if (this.isCurrentMonth) {
        return `${days} of ${totalDaysInMonth} working days elapsed`;
      }
      return `${days} working days`;
    },
  },

  watch: {
    'leaderboardStore.selectedYear'() {
      this.leaderboardStore.fetchLeaderboard();
    },
    'leaderboardStore.selectedMonth'() {
      this.leaderboardStore.fetchLeaderboard();
    },
  },

  mounted() {
    this.leaderboardStore.fetchLeaderboard();
  },

  methods: {
    prevMonth() {
      this.leaderboardStore.prevMonth();
    },

    nextMonth() {
      this.leaderboardStore.nextMonth();
    },

    formatDuration(seconds: number): string {
      return seconds_to_duration(seconds);
    },

    avgTooltip(entry: LeaderboardEntry): string {
      const totalHrs = (entry.totalProductiveSeconds / 3600).toFixed(1);
      const avgHrs = (entry.avgProductiveSecondsPerDay / 3600).toFixed(1);
      return (
        `<div style="text-align: left;">` +
        `<b>Total productive:</b> ${totalHrs}h<br>` +
        `<b>Working days:</b> ${entry.workingDays}<br>` +
        `<b>Average per day:</b> ${avgHrs}h/day<br>` +
        `<small class="text-muted">${totalHrs}h / ${entry.workingDays} days</small>` +
        `</div>`
      );
    },

    rankClass(index: number): string {
      if (index === 0) return 'rank-gold';
      if (index === 1) return 'rank-silver';
      if (index === 2) return 'rank-bronze';
      return '';
    },

    rowClass(index: number): string {
      if (index === 0) return 'row-gold';
      if (index === 1) return 'row-silver';
      if (index === 2) return 'row-bronze';
      return '';
    },

    progressClass(index: number): string {
      if (index === 0) return 'progress-gold';
      if (index === 1) return 'progress-silver';
      if (index === 2) return 'progress-bronze';
      return '';
    },

    progressPercent(entry: LeaderboardEntry): string {
      if (this.maxProductive === 0) return '0';
      return ((entry.totalProductiveSeconds / this.maxProductive) * 100).toFixed(0);
    },
  },
};
</script>
