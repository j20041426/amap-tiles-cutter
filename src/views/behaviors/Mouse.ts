import { throttle } from 'throttle-debounce';

export default function useMouse(target: any, callback: Function, isDrag: boolean = false) {
  if (isDrag) {
    target.on('dragging', throttle(20, (e: any) => {
      callback(e);
    }))
    target.on('dragend', (e: any) => {
      callback(e);
    })
  } else {
    let isDown = false;
    target.on('mousedown', () => {
      isDown = true;
    })
    target.on('mousemove', throttle(20, (e: Event) => {
      console.log(e);
      if (isDown) {
        console.log(111);
      }
    }))
  }
}