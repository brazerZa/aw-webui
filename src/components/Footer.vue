<template lang="pug">
div.container(style="color: #555; font-size: 0.9em")
  div.mb-2
    | Powered by
    icon(name="heart" scale=0.75 style="fill: #D2691E; margin: 0 0.3em;")
    a(href="https://malachi.co.uk" target="_blank" style="color: #D2691E;") Malachi Contractors
    |  &mdash; Activity Tracking
    div
      span.mt-2(v-if="info", style="color: #888; font-size: 0.8em")
        span.mr-2
          b Host:
          | &nbsp; {{info.hostname}}
        span
          b Version:
          | &nbsp; {{info.version}}
</template>

<script lang="ts">
// only import the icons you use to reduce bundle size
import 'vue-awesome/icons/brands/twitter';
import 'vue-awesome/icons/brands/github';
import 'vue-awesome/icons/hand-holding-heart';
import 'vue-awesome/icons/vote-yea';
import 'vue-awesome/icons/question-circle';
import 'vue-awesome/icons/bug';
import 'vue-awesome/icons/heart';

import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';

export default {
  name: 'Footer',
  computed: {
    ...mapState(useServerStore, ['info']),
  },
};
</script>
