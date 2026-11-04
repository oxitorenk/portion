import { mount } from 'svelte';
import '@fontsource/outfit/latin-ext-400.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-ext-500.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-ext-700.css';
import '@fontsource/outfit/latin-700.css';
import './style.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
