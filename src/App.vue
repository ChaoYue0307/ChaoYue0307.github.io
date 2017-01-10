<template>
  <div id="app">
    <img src="./assets/logo.png" width="15%">
    <h1>{{ msg }}</h1>
    <app-navbar></app-navbar>
    <app-conference></app-conference>
    
  </div>
</template>

<script>
import Conference from './components/Conference.vue';
import NavBar from './components/NavBar.vue';

export default {
  name: 'app',
  data () {
    return {
      msg: "Welcome to ChaoYue's Portal"
    }
  },
  components: {
    appConference: Conference,
    appNavbar: NavBar
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

h1, h2 {
  font-weight: normal;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

a {
  color: #42b983;
}
</style>
