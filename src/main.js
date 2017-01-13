import Vue from 'vue'
import App from './App.vue'
import VueRouter from 'vue-router';
import VueMaterial from 'vue-material';

Vue.use(VueRouter);
Vue.use(VueMaterial);


new Vue({
  el: '#app',
  render: h => h(App)
})
