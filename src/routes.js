import Home from './components/Home.vue';
import CV from './components/CV.vue';
import Portfolio from './components/Portfolio.vue';
import Conference from './components/Conference.vue';
import AboutMe from './components/AboutMe.vue';

export const routes = [
    { path: '/', component: Home },
    { path: '/CV', component: CV },
    { path: '/Portfolio', component: Portfolio },
    { path: '/Conference', component: Conference},
    { path: '/AboutMe', component: AboutMe }  
];