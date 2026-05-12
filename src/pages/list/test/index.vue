<template>
  <div class="wrap">
    <div class="pic-list">
      <div v-for="item in picList" :key="item.name" class="pic-item" @click="selectPic(item)">
        <t-image :src="item.url" fit="fill" />
      </div>
    </div>
    <div class="label-form" ref="labelFormRef">
      <DataLabel ref="dataLabelRef" :detailData="detailData" :url="current.url" @getText="getText" @addShape="addShape"
        @drag="drag" @shapeMoveing="shapeMoveing" @shapeChange='shapeChange' @zoom="zoom" @deleteShape="deleteShape" />
      <div class="form-wrap">
        <div>
          <div class="form-list" :class="{ 'form-list-active': currentFileIndex === i }" v-for="(item, i) in formList"
            :key="item.field" @click="selectFile(i)">
            <t-collapse borderless defaultExpandAll :expandOnRowClick="false">
              <t-collapse-panel>
                <template #header>
                  <div class="form-item-header" @click="selectFile(i)">
                    <span>{{ item.label }}</span>
                    <t-button variant="text" shape="square" @click.stop="addItem(item)">
                      <t-icon name="add" />
                    </t-button>
                  </div>
                </template>
                <t-form ref="form" :colon="true" label-align="top">
                  <t-form-item :class="`formItem-${i}-${j}`" name="name" v-for="(it, j) in item.values" :key="it.id">
                    <t-input v-model="it.value" @focus="focusInput(i, j)" placeholder="请输入内容"></t-input>
                    <template #statusIcon>
                      <t-button variant="text" shape="square" v-if="item.values.length > 1"
                        @click.stop="removeItem(item, j)">
                        <t-icon name="remove" />
                      </t-button>
                    </template>
                  </t-form-item>
                </t-form>
              </t-collapse-panel>
            </t-collapse>
          </div>
        </div>
      </div>
      <PolylineSvg :points="linePoints" :width="width" :height="height" />
    </div>
  </div>
</template>

<script setup lang="ts">

import { nextTick, onMounted, ref, onUnmounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import dataJson from './data.json';
import BScroll from 'better-scroll'
import DataLabel from './components/DataLabel.vue';
import PolylineSvg from './components/PolylineSvg.vue';
import CanvasToMark from '@/components/CanvasLabel/index';
// 1. 定义数据结构
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

// 2. 响应式数据
const detailData = ref<IDetailData[]>([]);
const picList = ref([
  {
    url: '/test1.jpg',
    name: 'test1',
    data: [],
  },
  {
    url: '/test2.jpg',
    name: 'test2',
    data: [],
  },
  {
    url: '/test1.jpg',
    name: 'test3',
    data: [],
  },
  {
    url: '/test2.jpg',
    name: 'test4',
    data: [],
  },
  {
    url: '/test1.jpg',
    name: 'test5',
    data: [],
  },
  {
    url: '/test2.jpg',
    name: 'test6',
    data: [],
  }
]);
const current = ref(picList.value[0]);
// 选择图片
const selectPic = (item: any) => {
  current.value = item;
};
// 标注的是第几个字段
const currentFileIndex = ref(0);
const currentFileValuesIndex = ref(0);
const formList = ref([
  {
    field: 'name',
    label: '字段1',
    values: [
      {
        value: '',
        uuid: '',
        id: Math.random() + 1,
      }
    ]
  },
  {
    field: 'age',
    label: '字段2',
    values: [{
      value: '',
      uuid: '',
      id: Math.random() + 1,
    }]
  },
  {
    field: 'sex',
    label: '字段3',
    values: [{
      value: '',
      uuid: '',
      id: Math.random() + 3,
    }]
  }
])
const selectFile = (index: number) => {
  currentFileIndex.value = index;
  if (currentSelShape.value) {
    const fileIndex = formList.value.findIndex(item => {
      return item.values.find((it: any) => it.uuid === currentSelShape.value.uuid)
    });
    if (fileIndex === index) {
      const valuesIndex = formList.value[index].values.findIndex((it: any) => it.uuid === currentSelShape.value.uuid);
      if (valuesIndex !== -1) {
        currentFileValuesIndex.value = valuesIndex;
      } else {
        console.error('当前选中的标注没有对应的输入框数据，重置当前字段的标注数据索引');
        // currentFileValuesIndex.value = 0;
      }
    } else {
      currentFileValuesIndex.value = 0;
    }
  } else {
    currentFileValuesIndex.value = 0;
  }
}
// TODO 
const addItem = (item: any) => {
  item.values.push({
    value: '',
    uuid: '',
    id: Date.now(),
  });
  updateEndPoint()
}
const removeItem = (item: any, index: number) => {
  console.log('删除输入框', formList.value, [...item.values], index);
  // 删除输入框有标注数据
  if (item.values[index].uuid) {
    // 清除对应的标注的线
    if (currentSelShape.value) {
      const currentUuid = currentSelShape.value.uuid
      // 如果删除的输入框对应的标注刚好被选中，清除折线
      if (item.values[index].uuid === currentUuid) {
        linePoints.value = [];
      }
    }
    // 删除标注数据
    console.log('删除id', item.values[index].uuid)
    dataLabelRef.value && dataLabelRef.value.delShapeById(item.values[index].uuid);
  }
  // 更新当前字段的标注数据索引
  if (currentFileValuesIndex.value >= index && currentFileValuesIndex.value > 0) {
    currentFileValuesIndex.value--;
  }
  item.values.splice(index, 1);
  updateEndPoint()
}
let scroll: BScroll | null = null;
const initScroll = () => {
  scroll = new BScroll('.form-wrap', {
    scrollY: true,
    scrollbar: true,
    // scrollbar: {
    //   fade: false,
    //   interactive: true,
    // },
    click: true,
    mouseWheel: true,
    bounce: false,
    probeType: 3, // 实时监听滚动事件
  });
  scroll.on('scroll', onScroll)
}

const destroyScroll = () => {
  if (scroll) {
    scroll.destroy();
    scroll = null;
  }
}
watch(formList, () => {
  nextTick(() => {
    scroll && scroll.refresh();
  });
}, { deep: true });
onMounted(() => {
  initScroll();
});
onUnmounted(() => {
  destroyScroll();
});
// 滚动的时候更新末位点
const onScroll = () => {
  updateEndPoint()
};
const updateEndPoint = () => {
  if (currentSelShape.value) {
    const entPoint = computeFormItemPosition(currentSelShape.value)
    if (entPoint && linePoints.value.length) {
      const midPoint = {
        x: entPoint.x - 20,
        y: entPoint.y,
      }
      linePoints.value[1] = midPoint;
      linePoints.value[2] = entPoint;
    }
  }
}
// 点击输入框的时候，如果有标注数据，选中对应的标注
const focusInput = (i: number, j: number) => {
  console.log('focus输入框', i, j);
  const uuid = formList.value[i].values[j].uuid;
  if (uuid) {
    currentFileValuesIndex.value = j;
    const shape = dataLabelRef.value.getShapeById(uuid);
    if (shape) {
      selectShape(shape);
    }
  }
}
const isAutoScrolling = ref(false);
// i表示第几个字段，j表示第几个值
const scrollToEl = (i: number, j: number) => {
  return new Promise(async (resolve) => {
    if (scroll) {
      const target = document.querySelector(`.formItem-${i}-${j}`);
      if (target) {
        isAutoScrolling.value = true;
        await scroll.scrollToElement(target as HTMLElement, 500, 0, 0);
        isAutoScrolling.value = false;
        resolve(true);
      }
    }
  })
}

// 数据获取函数
const getPicDetail = async () => {
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    detailData.value = dataJson.response;
  } catch (error) {
    console.log(error);
  }
};
getPicDetail();
// 标注交互
const dataLabelRef = ref();
// 添加标注
const addShape = (shape: IShape) => {
  // console.log('添加的标注数据', formList.value, currentFileIndex.value, currentFileValuesIndex.value);
  // 遍历 当前字段的值，找到第一个没有标注的输入框，添加标注数据，如果都填了数据则提示用户新增输入框或者选择其他字段
  while (currentFileValuesIndex.value < formList.value[currentFileIndex.value].values.length
  ) {
    if (formList.value[currentFileIndex.value].values[currentFileValuesIndex.value].uuid) {

      if (currentFileValuesIndex.value === formList.value[currentFileIndex.value].values.length - 1) {
        // 已经有标注了，不能添加了
        MessagePlugin.warning('该字段输入框已经有标注了，不能添加了，请新增输入框或选择其他字段');
        dataLabelRef.value && dataLabelRef.value.delShapeById(shape.uuid);
        break;
      } else {
        currentFileValuesIndex.value++;
      }
    } else {
      formList.value[currentFileIndex.value].values[currentFileValuesIndex.value].uuid = shape.uuid;
      // 加一个延时，等线清除完了再画新的线
      setTimeout(() => {
        selectShape(shape);
      }, 100);
      break;
    }
  }
}
// 获取选中的文字
const getText = (data: { shape: IShape, text: string }) => {
  const item = formList.value[currentFileIndex.value].values[currentFileValuesIndex.value]
  if (data.shape.uuid === item.uuid) {
    formList.value[currentFileIndex.value].values[currentFileValuesIndex.value].value = data.text;
  }
}
// 点击选中某个标注
const currentSelShape = ref<IShape>()
// 折线点
const linePoints = ref<{ x: number, y: number }[]>([]);
const height = ref(0);
const width = ref(0);
const labelFormRef = ref();
onMounted(() => {
  if (labelFormRef.value) {
    width.value = labelFormRef.value!.clientWidth;
    height.value = labelFormRef.value!.clientHeight;
  }
})
const selectShape = async (shape: IShape) => {
  autoScrollToFormItem(shape);
  if (currentSelShape.value) {
    if (currentSelShape.value.uuid === shape.uuid) {
      return
    } else {
      // 清楚之前的折线
      linePoints.value = [];
    }
  }
  currentSelShape.value = shape;

  const fileIndex = formList.value.findIndex(item => {
    return item.values.find((it: any) => it.uuid === shape.uuid)
  });
  if (fileIndex !== -1) {
    currentFileIndex.value = fileIndex;
    const valuesIndex = formList.value[fileIndex].values.findIndex((it: any) => it.uuid === shape.uuid);
    if (valuesIndex !== -1) {
      currentFileValuesIndex.value = valuesIndex;
    }
  }
  // 计算标注框相对于canvas的坐标位置 
  const startPoint = computeShapeScreenPosition(shape)
  const entPoint = computeFormItemPosition(shape)
  if (entPoint) {
    // 计算中间点的折线点
    const midPoint = {
      x: entPoint.x - 20,
      y: entPoint.y,
    }
    linePoints.value = [startPoint, midPoint, entPoint];
    // console.log('折线点', linePoints);
  }
}
// 更新起始点坐标
const updateStartPoint = () => {
  if (currentSelShape.value) {
    // 更新起始点坐标
    const startPoint = computeShapeScreenPosition(currentSelShape.value)
    linePoints.value[0] = startPoint;
  }
}
const drag = (canvasMark: CanvasToMark) => {
  // 选中过标注后，拖动标注框，改变标注框位置
  updateStartPoint();
}
// 标注拖动移动，改变标注框位置
const shapeMoveing = (shape: IShape) => {
  if (currentSelShape.value) {
    if (currentSelShape.value.uuid === shape.uuid) {
      // 更新当前选中的标注数据
      currentSelShape.value = shape;
      // 更新折线起始点坐标
      updateStartPoint();
    }
  }
}
// 标注改变（大小形状改变）
const shapeChange = (shape: IShape) => {
  if (currentSelShape.value) {
    if (currentSelShape.value.uuid === shape.uuid) {
      // 更新当前选中的标注数据
      currentSelShape.value = shape;
      // 更新折线起始点坐标
      updateStartPoint();
    }
  }
}
const zoom = () => {
  // 滚动的时候更新起始点
  updateStartPoint();
}
// 清除标注后，删除对应输入框的标注数据
const deleteShape = (shape: IShape) => {
  console.log('删除的标注数据', currentSelShape.value, shape);
  // 如果选的标注是当前选中的标注，清除当前选中的标注和折线
  if (currentSelShape.value && currentSelShape.value.uuid === shape.uuid) {
    // 清楚折线
    linePoints.value = [];
    currentSelShape.value = null;
  }
  // 清楚标注对应的输入框内容
  formList.value.forEach(item => {
    item.values.forEach((it: any) => {
      if (it.uuid === shape.uuid) {
        it.value = '';
        it.uuid = '';
      }
    })
  })
}
// 找到对应的输入框，滚动到可见位置
const autoScrollToFormItem = async (shape: IShape) => {
  const indexData = findFormIndex(shape.uuid);
  if (indexData) {
    const target = document.querySelector(`.formItem-${indexData.ci}-${indexData.cj}`);
    const domIsVisible = isElementInViewport(target)
    // 不可见
    if (!domIsVisible) {
      scrollToEl(indexData.ci, indexData.cj);
    }
  }
}
const computeFormItemPosition = (shape: IShape) => {
  const pos = { x: 0, y: 0 };
  const indexData = findFormIndex(shape.uuid)
  // console.log('找到标注对应的输入框索引', ci, cj);
  // 找到了标注对应的输入框索引，滚动到可见位置
  if (indexData) {
    const target = document.querySelector(`.formItem-${indexData.ci}-${indexData.cj}`);
    const rect = target.getBoundingClientRect();
    const wrapEl = document.querySelector('.form-wrap');
    const wrapElRect = wrapEl.getBoundingClientRect();
    // TODO 具体ui的时候调整偏移
    pos.x = dataLabelRef.value.width - 4
    pos.y = rect.top - wrapElRect.top + rect.height / 2;
    return pos;
  }
}
// 根据标注uuid找到对应的输入框索引
const findFormIndex = (uuid: string) => {
  const len = formList.value.length
  let ci = 0, cj = 0;
  for (let i = 0; i < len; i++) {
    const j = formList.value[i].values.findIndex((item: any) => {
      return item.uuid === uuid
    })
    cj = j;
    if (j !== -1) {
      ci = i;
      break
    }
  }
  if (cj !== -1) {
    return { ci, cj }
  }
}
// 判断目标元素是否可见
function isElementInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// 计算标注框相对于canvas的坐标位置 
const computeShapeScreenPosition = (shape: IShape) => {
  if (!dataLabelRef.value) return;
  const { originX, originY, IMAGE_ORIGIN_WIDTH, IMAGE_WIDTH } = dataLabelRef.value.getCanvasMark();
  const scale = IMAGE_WIDTH / IMAGE_ORIGIN_WIDTH;
  const point = findRightPoint(shape);
  const x = originX + point.x * scale;
  const y = originY + point.y * scale;
  // console.log('标注框右侧连接点相对于canvas坐标', { x, y });
  return { x, y };
}
// 找到标注右侧的连接起始点，返回该点相对于canvas的坐标
const findRightPoint = (shape: IShape) => {
  const xList = shape.coor.map(p => {
    return p[0]
  })
  const yList = shape.coor.map(p => {
    return p[1]
  })
  const maxX = Math.max(...xList);
  const maxY = Math.max(...yList);
  // 如果画的是矩形，返回右下角坐标
  if (shape.type === 1) {
    return { x: maxX, y: maxY }
  } else {
    // 如果是多边形，返回最右边的点
    const rightPointIndex = xList.findIndex(x => x === maxX);
    return { x: maxX, y: yList[rightPointIndex] }
  }
}
//实现动态折线
</script>

<style lang="less" scoped>
.wrap {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.pic-list {
  width: 200px;
  flex-shrink: 0;
  overflow-y: scroll;
  height: 100%;
  z-index: 3;
  background-color: white;
}

.label-form {
  flex: 1;
  display: flex;
  position: relative;
}


.form-wrap {
  position: relative;
  width: 300px;
  flex-shrink: 0;
  overflow: hidden;
  height: 100%;
  z-index: 3;
  background-color: white;

  .form-list-active {
    border: 1px solid red;
  }

  .form-item-header {
    flex: 1;
  }
}
</style>