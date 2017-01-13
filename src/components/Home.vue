<template>
  <div>
    <app-navbar></app-navbar>
    <app-conference></app-conference>    
  </div>
</template>

<script>
import Conference from './Conference.vue';
import NavBar from './NavBar.vue';

export default {
  components: {
    appConference: Conference,
    appNavbar: NavBar
  }
}
</script>