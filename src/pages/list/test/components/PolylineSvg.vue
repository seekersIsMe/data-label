<template>
  <svg v-if="points.length > 0" class="polyline-svg" :width="width" :height="height">
    <!-- 折线 -->
    <polyline :points="pointsString" fill="none" :stroke="strokeColor" :stroke-width="strokeWidth" />
    <!-- 每个点处的小圆环 -->
    <circle v-for="(point, index) in points" :key="index" :cx="point.x" :cy="point.y" :r="circleRadius"
      :fill="circleFill" :stroke="circleColor" :stroke-width="strokeWidth" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Point {
  x: number;
  y: number;
}

interface Props {
  points: Point[];
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  circleRadius?: number;
  circleColor?: string;
  circleFill?: string;
}

const props = withDefaults(defineProps<Props>(), {
  points: () => [],
  width: 500,
  height: 500,
  strokeColor: '#618dff',
  strokeWidth: 2,
  circleRadius: 4,
  circleColor: '#618dff',
  circleFill: '#fff',
});

// 将点数组转换为 polyline 需要的字符串格式 "x1,y1 x2,y2 x3,y3"
const pointsString = computed(() => {
  return props.points.map(p => `${p.x},${p.y}`).join(' ');
});
</script>

<style scoped>
.polyline-svg {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
  pointer-events: none;
}
</style>
