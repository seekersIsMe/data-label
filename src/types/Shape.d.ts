interface IShape {
    label: string;
    coor: [number, number][];
    strokeStyle: string;
    fillStyle: string;
    labelFillStyle: string;
    labelFont: string;
    type: number;
    active: boolean;
    creating: boolean;
    dragging: boolean;
    index: number;
    uuid: string;
}