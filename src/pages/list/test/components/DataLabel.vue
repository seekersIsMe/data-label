<template>
  <div class="canvas-wrap" ref="canvasWrapRef">
    <canvas id="container" ref="canvasRef" :width="width" :height="height"></canvas>
    <div class="btn-wrap">
      <t-button theme="primary" @click="changeType(1)">矩形</t-button>
      <t-button theme="primary" @click="changeType(2)">多边形</t-button>
      <t-button theme="primary" @click="zoom(true)">放大</t-button>
      <t-button theme="primary" @click="zoom(false)">缩小</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, onUnmounted, watch } from 'vue';
import CanvasToMark from '@/components/CanvasLabel/index';
import { debounce, throttle } from 'lodash';
const width = ref(800);
const height = ref(600);
const canvasRef = ref<HTMLCanvasElement>();
const canvasWrapRef = ref<HTMLCanvasElement>();
let canvasMark: CanvasToMark | null = null;
export interface IDetailData {
  fileIndex: number;
  detail: {
    data: string;
    pixelCoordinates: number[];
    charPixelCoordinates: number[][];
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  }[]
}
const props = defineProps<{
  detailData: IDetailData[];
  url: string;
  activeId?: string // 当前选中的标注id
}>();
// 标注图片变化时重置画布
watch(() => props.url, () => {
  updatecanvas();
});
const updatecanvas = () => {
  if (canvasMark) {
    canvasMark.setImage(props.url);
    // 重置数据
    canvasMark.setData([])
  }
};
// 选择中的标注数据
const selectShape = ref<IShape>(null);
const initCanvas = () => {
  canvasMark = new CanvasToMark('#container', props.url);
  canvasMark.strokeStyle = 'rgb(52,244,39)';
  canvasMark.zoomCenter = 'mouse';
  canvasMark.createType = 1;
  canvasMark.on('load', () => {
    console.log('实例', canvasMark)
  });
  canvasMark.on('add', (data: IShape) => {
    emits('addShape', data);
  });
  // 选中图形
  canvasMark.on('select', (data: IShape) => {
    selectShape.value = data;
    emits('selectShape', data);
  });
  canvasMark.on('updated', (data: IShape) => {
    // console.log('更', data)
    if (!data) return;
    if (!data.coor.length || data.coor.length === 1) return;
    // 判断两个点是一样的
    if (data.coor.length == 2 && JSON.stringify(data.coor[0]) === JSON.stringify(data.coor[1])) return
    // 判断画的矩形或者多边形是平移还是大小形状发生了变化
    const item = canvasMark.dataset.find((item: IShape) => item.uuid === data.uuid);
    if (!item) return;
    if (data.dragging) {
      // console.log('拖动了', data);
      emits('shapeMoveing', data);
    } else {
      // console.log('改变了', data);
      emits('shapeChange', data);
    }
    // 获取选中的文字
    getTextByShape(data);
  });
  canvasMark.on('delete', (data: IShape) => {
    emits('deleteShape', data);
  });
};

const changeType = (type: number) => {
  if (canvasMark) {
    canvasMark.createType = type;
    canvasMark.update();
  }
};

const zoom = (type: boolean) => {
  canvasMark && canvasMark.setScale(type);
  emits('zoom', canvasMark);
};

// 初始化，事件监听，派发
// 鼠标拖拽、标注拖拽移动，标注改变（大小形状改变）、鼠标滚轮缩放
const emits = defineEmits(['drag', 'shapeMoveing', 'shapeChange', 'zoom', 'selectShape', 'deleteShape', 'addShape', 'getText']);
const handleDrag = throttle(() => {
  emits('drag', canvasMark);
}, 30);
const handleZoom = throttle(() => {
  emits('zoom', canvasMark);
}, 30);
onMounted(async () => {
  await nextTick();
  width.value = canvasWrapRef.value!.clientWidth;
  height.value = canvasWrapRef.value!.clientHeight - 8;
  initCanvas();
  if (canvasWrapRef.value) {
    canvasWrapRef.value.addEventListener('mousemove', (e) => {
      // 右键拖动画布
      if (e.buttons === 2) {
        handleDrag();
      }
    });
  }
  if (canvasWrapRef.value) {
    canvasWrapRef.value.addEventListener('wheel', (e) => {
      e.preventDefault();
      handleZoom();
    });
  }
});
// 获取绘制的方框数据
const dataSet = ref<any>([]);
const getDrawData = () => {
  if (canvasMark) {
    dataSet.value = canvasMark.dataset;
    console.log('当前标注数据', dataSet.value);
  }
};
const delShapeById = (uuid: string) => {
  if (canvasMark) {
    const item = canvasMark.dataset.find((item: IShape) => item.uuid === uuid)
    if (item) {
      canvasMark.deleteByIndex(item.index);
    }
  }
}
const getCanvasMark = () => {
  return canvasMark;
}
const getShapeById = (uuid: string) => {
  if (canvasMark) {
    return canvasMark.dataset.find((item: IShape) => item.uuid === uuid);
  }
}
// 暴露方法
defineExpose({
  getCanvasMark,
  getDrawData,
  delShapeById,
  getShapeById,
  width
})
// 核心文字提取函数
const getTextByShape = debounce((shape: IShape) => {
  // shape的坐标，转多边形
  const shapeCoords = shapeCoorToPolygon(shape.coor);
  // 获取数据列表
  const responseList = props.detailData;
  const result: string[] = [];

  for (const item of responseList) {
    if (!item.detail) continue;
    for (const textBlock of item.detail) {
      // 1. 获取文字块的boundingBox（4坐标）并转多边形
      const boundingBox = textBlock.pixelCoordinates;
      const bboxPolygon = coordsToPolygon(boundingBox);

      // 判断多边形是否包含或相交于boundingBox
      const isContained = bboxPolygon.every((point) => isPointInPolygon(point, shapeCoords));
      const isIntersecting = isPolygonIntersect(shapeCoords, bboxPolygon);
      if (isContained) {
        // 2. 如果多边形包含整个boundingBox，直接返回该文字块
        result.push(textBlock.data);
      } else if (isIntersecting) {
        // 3. 如果相交，进一步判断单个文字包围盒是否与多边形相交或被包含
        const charCoords = textBlock.charPixelCoordinates || [];
        for (let i = 0; i < charCoords.length; i++) {
          // 将单个文字的8坐标转换为多边形顶点数组
          const charPolygon = coordsToPolygon(charCoords[i]);
          // 判断单个文字包围盒是否被多边形包含
          const isCharContained = charPolygon.every((point) => isPointInPolygon(point, shapeCoords));
          // 判断单个文字包围盒是否与多边形相交
          const isCharIntersecting = isPolygonIntersect(shapeCoords, charPolygon);
          if (isCharContained || isCharIntersecting) {
            // 返回该文字
            const charText = textBlock.data[i] || '';
            if (charText) {
              result.push(charText);
            }
          }
        }
      }
    }
  }
  console.log('选中的文字:', result);
  emits('getText', { shape, text: result.join('') });
}, 300);
// 4. 几何算法函数
/**
 * 判断点是否在多边形内（射线法）
 * @param point 待判断的点 [x,y]
 * @param polygon 多边形顶点数组 [[x1,y1],[x2,y2],...]
 */
const isPointInPolygon = (point: number[], polygon: number[][]): boolean => {
  const [x, y] = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    // 跳过水平边，避免除零错误
    if (yi === yj) continue;
    // 检查点是否在边的y范围内（点在边的上下两侧）
    const above1 = yi > y;
    const above2 = yj > y;
    const inYRange = above1 !== above2;
    if (inYRange) {
      const intersectionX = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < intersectionX) inside = !inside;
    }
  }
  return inside;
};

/**
 * 判断两条线段是否相交
 */
const segmentsIntersect = (p1: number[], p2: number[], p3: number[], p4: number[]): boolean => {
  const ccw = (a: number[], b: number[], c: number[]) => {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
};

/**
 * 判断两个多边形是否相交
 * @param poly1 多边形1顶点数组
 * @param poly2 多边形2顶点数组
 */
const isPolygonIntersect = (poly1: number[][], poly2: number[][]): boolean => {
  // 检查poly1的任一顶点是否在poly2内
  for (const point of poly1) {
    if (isPointInPolygon(point, poly2)) return true;
  }
  // 检查poly2的任一顶点是否在poly1内
  for (const point of poly2) {
    if (isPointInPolygon(point, poly1)) return true;
  }
  // 检查边是否相交
  const edgesIntersect = (p1: number[][], p2: number[][]) => {
    const n1 = p1.length;
    const n2 = p2.length;
    for (let i = 0; i < n1; i++) {
      const a1 = p1[i];
      const a2 = p1[(i + 1) % n1];
      for (let j = 0; j < n2; j++) {
        const b1 = p2[j];
        const b2 = p2[(j + 1) % n2];
        if (segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    return false;
  };
  return edgesIntersect(poly1, poly2);
};

/**
 * 将Shape的coor转换为多边形顶点数组
 * 如果是矩形(2个点)则转换为4个顶点，如果是多边形(多个点)直接返回
 */
const shapeCoorToPolygon = (coor: number[][]): number[][] => {
  // 示例：假设coor格式为 [x1, y1, x2, y2, ...]
  // 矩形逻辑（两个点->四个顶点）
  if (coor.length === 2) {
    // 矩形： 只有对角线两个点，需要转换为四个顶点
    const [p1, p2] = coor;
    const x1 = Math.min(p1[0], p2[0]);
    const y1 = Math.min(p1[1], p2[1]);
    const x2 = Math.max(p1[0], p2[0]);
    const y2 = Math.max(p1[1], p2[1]);
    return [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2]
    ];
  }
  return coor;
};

/**
 * 将坐标数组（如4点、8点）转换为多边形顶点数组
 */
const coordsToPolygon = (coords: number[]): number[][] => {
  const polygon: number[][] = [];
  for (let i = 0; i < coords.length; i += 2) {
    polygon.push([coords[i], coords[i + 1]]);
  }
  return polygon;
};
</script>

<style scoped lang="less">
.canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 100%;

  canvas {
    width: 100%;
    height: 100%;
  }

  .btn-wrap {
    position: absolute;
    top: 0;
    left: 0;
  }
}
</style>