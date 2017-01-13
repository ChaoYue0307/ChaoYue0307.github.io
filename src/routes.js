import Home from './components/Home.vue';
import Conference from './components/Conference.vue';
import AboutMe from './components/AboutMe.vue';

export const routes = [
    { path: '/', component: Home },
    { path: '/Conference', component: Conference},
    { path: '/AboutMe', component: AboutMe }  
];