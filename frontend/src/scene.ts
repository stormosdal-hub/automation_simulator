import {
  AppendSceneAsync,
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/** Scene setup + model load. Tag-driven behavior lives in the BindingEngine. */
export async function createScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  modelUrl: string | null,
): Promise<Scene> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.055, 0.065, 0.085, 1);

  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2.4,
    Math.PI / 2.7,
    5,
    new Vector3(0, 0.9, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 20;
  camera.wheelDeltaPercentage = 0.01;

  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.6;
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.35), scene);
  sun.position = new Vector3(4, 8, 3);
  sun.intensity = 1.1;

  const ground = MeshBuilder.CreateGround('ground', { width: 14, height: 14 }, scene);
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new Color3(0.11, 0.12, 0.14);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;

  // A model is optional: projects built purely from the machine library
  // (the usual case) leave modelUrl null and get an empty stage.
  if (modelUrl) await AppendSceneAsync(modelUrl, scene);
  return scene;
}
