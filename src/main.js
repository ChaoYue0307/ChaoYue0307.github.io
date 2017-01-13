import Vue from 'vue'
import App from './App.vue'
import VueRouter from 'vue-router';
import VueMaterial from 'vue-material';
import { routes } from './routes';

Vue.use(VueRouter);
Vue.use(VueMaterial);

const router = new VueRouter({
  routes,
  mode: 'history'
});


new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
