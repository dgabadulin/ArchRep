<template>
  <div class="tech-radar-page">
    <div class="page-head">
      <h1>Тех.радар</h1>
    </div>
    <iframe
      class="radar-iframe"
      :src="radarUrl"
      title="Технологический радар"
    />
  </div>
</template>

<script setup>
const radarUrl = 'https://radar.st.tech/?documentId=https://radar.st.tech/radar/platforma-a.csv'
</script>

<style scoped>
.tech-radar-page { height: calc(100vh - 8rem); display: flex; flex-direction: column; }
.page-head { margin-bottom: 0.5rem; }
.page-head h1 { margin: 0; font-size: 1.2rem; color: #2d2a26; }
.radar-iframe {
  flex: 1;
  width: 100%;
  border: 1px solid #e5dccf;
  border-radius: 8px;
  background: #fff;
}
</style>
