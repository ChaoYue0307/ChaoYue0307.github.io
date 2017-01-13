<template>
  <div>
    <app-navbar></app-navbar>
    <app-conference></app-conference>    
  </div>
</template>

<script>
import Conference from './Conference.vue';

export default {
  components: {
    appConference: Conference,
  }
}
</script>