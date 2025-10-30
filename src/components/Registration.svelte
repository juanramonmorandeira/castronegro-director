<script>
  import Topbar from './Topbar.svelte';
  import Footbar from './Footbar.svelte';
  import BackgroundLayer from './landing/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
</script>

<BackgroundLayer />

<div class="page">
  <Topbar titleKey="registration.title" />

  <main class="center">
    <div class="card-glass" style="padding:2rem; min-width:260px; width:min(640px,90vw)">
      <h2 style="margin:0 0 1rem 0">{$t('registration.title')}</h2>
      <p>{$t('registration.placeholder')}</p>
    </div>
  </main>

  <Footbar />
</div>

<style>
  .page { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
  .center { display: grid; place-items: center; padding: 2rem 1rem; }
</style>
