<template>
  <div class="wrapper flex column">
    <div class="toolbar flex ai-fs">
      <div class="step flex-1">
        <div class="title">1. 图片设置</div>
        <el-form label-position="top">
          <el-form-item label=" ">
            <el-button type="primary" @click="upload">上传图片</el-button>
            <input ref="refUpload" accept="image/*" type="file" style="display:none" :value="uploadValue" @change="onImageChange">
          </el-form-item>
          <el-form-item label="图片透明度">
            <el-slider style="max-width:300px" v-model="image.opacity" :min="0.01" :max="1" :step="0.01" :disabled="!image.src"></el-slider>
          </el-form-item>
        </el-form>
      </div>
      <div class="step flex-1">
        <div class="title">2. 切片设置</div>
        <el-form label-position="top">
          <el-form-item label="显示层级">
            <div class="flex" style="max-width:300px;width:100%">
              <el-slider class="flex-1" v-model="levels" :min="2" :max="20" :step="1" range :disabled="!image.src"></el-slider>
              <span style="margin-left:15px">{{levels}}</span>
            </div>
          </el-form-item>
          <el-form-item label="分辨率">
            <el-select v-model="ratio">
              <el-option v-for="(v,k) in ratioArr" :value="k+1" :label="v" :key="k"></el-option>
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div class="step flex-1">
        <div class="title">3. 切片</div>
        <div class="flex jc-fs">
          <el-button type="danger" @click="stopSlice" v-if="isSlicing">停止切片</el-button>
          <el-button type="primary" @click="slice" :disabled="!image.src" v-else>开始切片</el-button>
          <div class="status">{{sliceStatus}}</div>
        </div>
      </div>
    </div>
    <div id="container" class="map-container flex-col-1" v-loading="isSlicing"></div>
    <div class="search flex">
      <el-input size="small" placeholder="输入要查询的地址" v-model="addr"></el-input>
      <el-button size="small" type="primary" style="margin-left:10px" @click="search">查询</el-button>
      <el-checkbox size="small" v-model="showMesh" border style="margin-left:30px">显示网格</el-checkbox>
      <el-checkbox size="small" v-model="showSatellite" border>显示卫星地图</el-checkbox>
    </div>
    <div class="level">当前缩放级别：{{ currLevel }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from "vue";
import useMouse from './behaviors/Mouse'
import Common from '../utils/Common'
import JSZip from 'jszip'
const saveAs = require('jszip/vendor/FileSaver')

let map: any, placeSearch: any, AMap: any, imageLayer: any, meshLayer: any, satelliteLayer: any;
const currLevel = ref(14);
// 初始化地图
onMounted(() => {
  AMapLoader.load({
    "key": "5c4da1cc71b85ed46f65c2bf383c37fa",              // 申请好的Web端开发者Key，首次调用 load 时必填
    "version": "2.0",                                       // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
    "plugins": ['AMap.PlaceSearch', 'AMap.ToolBar'],        // 需要使用的的插件列表，如比例尺'AMap.Scale'等
  }).then((_AMap: any) => {
    AMap = _AMap;
    map = new AMap.Map('container', {
      center: [104.065774, 30.657497],
      zoom: currLevel.value,
    });

    // 监听当前缩放级别
    map.on('zoomchange', ({target}: any) => {
      currLevel.value = target.getZoom();
    })

    // 地址查询器
    placeSearch = new AMap.PlaceSearch();

    // 添加工具条
    map.addControl(new AMap.ToolBar());

    // 添加瓦片网格
    meshLayer = new AMap.TileLayer.Flexible({
      cacheSize: 30,
      zIndex: 200,
      createTile: (x: number, y: number, z: number, success: Function, fail: Function) => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;

        const cxt = c.getContext("2d")!;
        cxt.font = "15px Verdana";
        cxt.fillStyle = "#ff0000";
        cxt.strokeStyle = "#FF0000";
        cxt.strokeRect(0, 0, 256, 256);
        cxt.fillText('(' + [x, y, z].join(',') + ')', 10, 30);

        // 通知API切片创建完成
        success(c);
      }
    });
    map.addLayer(meshLayer);
    meshLayer.hide();

    // 添加卫星地图
    satelliteLayer = new AMap.TileLayer.Satellite();
    map.addLayer(satelliteLayer);
    satelliteLayer.hide();
  })
})

// 地址反查坐标
const addr = ref('');
const search = () => {
  placeSearch.search(addr.value, (status: string, res: any) => {
    if (status == 'complete' && res.info == 'OK' && res.poiList.pois.length > 0) {
      map.setCenter(res.poiList.pois[0].location, true);
    }
  });
}

// 显示网格
const showMesh = ref(false);
watch(showMesh, () => {
  showMesh.value ? meshLayer.show() : meshLayer.hide();
})

// 显示卫星地图
const showSatellite = ref(false);
watch(showSatellite, () => {
  showSatellite.value ? satelliteLayer.show() : satelliteLayer.hide();
})

// 地图图片
const image = reactive({
  src: '',
  bounds: {
    southWest: {},
    northEast: {}
  },
  opacity: 1
});
// 将image对象的改变同步到图层
watch(image, () => {
  if (imageLayer) {
    imageLayer.setImageUrl(image.src);
    imageLayer.setBounds(image.bounds);
    imageLayer.setOpacity(image.opacity);
  } else if (image.src) {
    // 创建图片图层
    imageLayer = new AMap.ImageLayer({
      url: image.src,
      bounds: image.bounds,
      opacity: image.opacity
    });
    map.addLayer(imageLayer);

    // 创建西南点 东北点
    const southWest = new AMap.Marker({
      label: {
        content: image.bounds.southWest,
        offset: new AMap.Pixel(0, -36),
        direction: 'center'
      },
      position: image.bounds.southWest,
      draggable: true
    })
    southWest.on('click', () => {
      Common.prompt('请输入西南点坐标经纬度').then(({value}) => {
        const [lng, lat] = value.split(',');
        if (lng && lat) {
          image.bounds.southWest = new AMap.LngLat(lng, lat);
          southWest.setPosition(image.bounds.southWest);
          southWest.setLabel({content: image.bounds.southWest});
        }
      })
    })
    useMouse(southWest, (e: any) => {
      image.bounds.southWest = e.target.getPosition();
      southWest.setLabel({content: image.bounds.southWest});
    }, true);
    map.add(southWest);
    const northEast = new AMap.Marker({
      label: {
        content: image.bounds.northEast,
        offset: new AMap.Pixel(0, -36),
        direction: 'center'
      },
      position: image.bounds.northEast,
      draggable: true
    })
    northEast.on('click', () => {
      Common.prompt('请输入东北点坐标经纬度').then(({value}) => {
        const [lng, lat] = value.split(',');
        if (lng && lat) {
          image.bounds.northEast = new AMap.LngLat(lng, lat);
          northEast.setPosition(image.bounds.northEast);
          northEast.setLabel({content: image.bounds.northEast});
        }
      })
    })
    useMouse(northEast, (e: any) => {
      image.bounds.northEast = e.target.getPosition();
      northEast.setLabel({content: image.bounds.northEast});
    }, true);
    map.add(northEast);
  }
})
const uploadValue = ref('');
const refUpload = ref<any>(null);
const upload = () => {
  refUpload.value?.click();
}
const onImageChange = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    image.bounds = map.getBounds();
    image.src = URL.createObjectURL(file);
  }
  uploadValue.value = '';
}

// 层级
const levels = ref([14, 14]);
// 分辨率
const ratio = ref(1);
const ratioArr = ['1x', '2x', '3x'];

const isSlicing = ref(false);
const sliceStatus = ref('');
// 开始切片
const slice = async () => {
  isSlicing.value = true;
  sliceStatus.value = '正在准备中...';
  await Common.waitFor(200);
  const bounds = image.bounds as any;
  const northWest: any = bounds.getNorthWest();
  const northEast: any = bounds.getNorthEast();
  const southEast: any = bounds.getSouthEast();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const meshCanvas = document.createElement('canvas');
  const meshCtx = meshCanvas.getContext('2d');
  const size = 256 * ratio.value;
  meshCanvas.width = size;
  meshCanvas.height = size;
  const img = await Common.loadImage(image.src);
  if (!img) {
    Common.toast('图层图片错误', 'error');
    isSlicing.value = false;
    sliceStatus.value = '发生错误';
    return;
  }
  // 初始化压缩包
  const zip = new JSZip();

  for (let i = levels.value[0]; i <= levels.value[1]; i++) {
    if (!isSlicing.value) break;

    // 获取图层所在网格范围
    const zoom = Math.floor(i);
    const tileXArr = [Common.lon2tile(northWest.getLng(), zoom), Common.lon2tile(northEast.getLng(), zoom)];
    const tileYArr = [Common.lat2tile(northEast.getLat(), zoom), Common.lat2tile(southEast.getLat(), zoom)];
    sliceStatus.value = `正在切片层级：${zoom}`;
    await Common.waitFor(200);

    // 新增层级文件夹
    const level = zip.folder(zoom.toString());

    // 绘制图层
    canvas.width = Math.round(tileXArr[1] - tileXArr[0] + 1) * size;
    canvas.height = Math.round(tileYArr[1] - tileYArr[0] + 1) * size;
    const imageLeftTop = map.lngLatToPixel(northWest, zoom);
    const imageRightBottom = map.lngLatToPixel(southEast, zoom);
    const originPos = new AMap.LngLat(Common.tile2lon(tileXArr[0], zoom), Common.tile2lat(tileYArr[0], zoom));
    const originPixel = map.lngLatToPixel(originPos, zoom);
    const nextPos = new AMap.LngLat(Common.tile2lon(tileXArr[1] + 1, zoom), Common.tile2lat(tileYArr[1] + 1, zoom));
    const nextPixel = map.lngLatToPixel(nextPos, zoom);
    const originOffset = [Math.round(imageLeftTop.x - originPixel.x) * ratio.value, Math.round(imageLeftTop.y - originPixel.y) * ratio.value];
    const nextOffset = [Math.round(nextPixel.x - imageRightBottom.x) * ratio.value, Math.round(nextPixel.y - imageRightBottom.y) * ratio.value];
    ctx?.drawImage(img, 0, 0, img.width, img.height, originOffset[0], originOffset[1], canvas.width - originOffset[0] - nextOffset[0], canvas.height - originOffset[1] - nextOffset[1]);

    // 分割图层
    const total = (tileXArr[1] - tileXArr[0] + 1) * (tileYArr[1] - tileYArr[0] + 1);
    let curr = 1;
    for (let x = tileXArr[0]; x <= tileXArr[1]; x++) {
      if (!isSlicing.value) break;
      for (let y = tileYArr[0]; y <= tileYArr[1]; y++) {
        if (!isSlicing.value) break;
        meshCtx?.clearRect(0, 0, size, size);
        meshCtx?.drawImage(canvas, (x - tileXArr[0]) * size, (y - tileYArr[0]) * size, size, size, 0, 0, size, size);
        level?.file(`tile_${x}_${y}.png`, meshCanvas.toDataURL().split(',')[1], {base64: true});
        sliceStatus.value = `正在切片层级：${zoom}，当前：${curr++}/${total}`;
        await Common.waitFor(5);
      }
    }
  }

  if (isSlicing.value) {
    sliceStatus.value = '切片完成，正在导出压缩包...';
    await Common.waitFor(200);

    // 下载压缩包
    zip.generateAsync({type:"blob"})
      .then(function(content) {
        isSlicing.value = false;
        sliceStatus.value = '切片成功';
        saveAs(content, "map.zip");
      });
  } else {
    sliceStatus.value = '用户停止切片';
  }
}
// 停止切片
const stopSlice = () => {
  isSlicing.value = false;
}
</script>

<style lang="less" scoped>
.wrapper {
  width: 100vw; height: 100vh; position: relative;
  .toolbar {
    width: 100%; height: 260px; padding: 30px;
    .title {
      margin-bottom: 30px;
    }
    .status {
      margin-left: 20px;
    }
  }
  .map-container {
    width: 100%;
  }
  .search {
    position: absolute; top: 270px; left: 10px;
  }
  .level {
    position: absolute; top: 270px; right: 10px;
  }
}
</style>