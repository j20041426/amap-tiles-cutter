export default class Common {
  static lon2tile(lon: number, zoom: number) {
    return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
  }
  static lat2tile(lat: number, zoom: number) {
    return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
  }
  static tile2lon(x: number, z: number) {
    return (x / Math.pow(2, z) * 360 - 180);
  }
  static tile2lat(y: number, z: number) {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  }
  static loadImage(url: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve(img);
      }
      img.onerror = () => {
        resolve(null);
      }
    })
  }
  static waitFor(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(0);
      }, ms);
    })
  }

  static loading:any
  static showLoading(msg:string = '加载中...') {
    this.loading = global.vue.$loading({
      text: msg
    })
  }
  static hideLoading() {
    this.loading && this.loading.close();
  }
  static alert(msg: string, type: string = 'error'):Promise<void> {
    return global.vue.$alert(msg, '温馨提示', {
      type,
      confirmButtonText: '确定',
      roundButton: true
    });
  }
  static confirm(msg: string, type: string = 'warning'):Promise<void> {
    return global.vue.$confirm(msg, '温馨提示', {
      type,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      roundButton: true,
      distinguishCancelAndClose: true
    })
  }
  static prompt(msg: string, type: string = 'warning'):Promise<any> {
    return global.vue.$prompt(msg, '温馨提示', {
      type,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      roundButton: true,
      distinguishCancelAndClose: true
    })
  }
  static toast(msg: string, type: string = 'success'):void {
    global.vue.$message({
      message: msg,
      type
    });
  }
}