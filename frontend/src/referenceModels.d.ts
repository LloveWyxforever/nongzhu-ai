import * as THREE from 'three';
export interface CropModel {
 group:THREE.Group;
 leafMats:THREE.MeshStandardMaterial[];
 fruits:{mesh:THREE.Object3D;at:number;base?:THREE.Vector3}[];
 leafBase:THREE.Color;leafRipe:THREE.Color;unripe:THREE.Color;ripe:THREE.Color;
 earMat?:THREE.MeshStandardMaterial;fruitMat?:THREE.MeshStandardMaterial;ears?:THREE.InstancedMesh;
 height:number;
}
export function buildWheat():CropModel;
export function buildCorn():CropModel;
export function buildCarrot():CropModel;
export function buildTomato():CropModel;
export function buildPumpkin():CropModel;
