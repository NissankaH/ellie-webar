"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function EllieAR() {
    const containerRef = useRef(null);

    useEffect(() => {
        let scene;
        let camera;
        let renderer;
        let controller;
        let reticle;

        let hitTestSource = null;
        let hitTestSourceRequested = false;

        let storyRoot = null;

        let scene1Model = null;
        let scene2Model = null;
        let scene3Model = null;
        let scene4Model = null;

        let storyPlaced = false;
        let modelsReady = false;

        // -----------------------------------------
        // THREE SCENE
        // -----------------------------------------

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            50
        );

        // -----------------------------------------
        // LIGHTS
        // -----------------------------------------

        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,
            0x444444,
            3
        );

        scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(
            0xffffff,
            2
        );

        directionalLight.position.set(
            2,
            4,
            2
        );

        scene.add(directionalLight);

        // -----------------------------------------
        // RENDERER
        // -----------------------------------------

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        renderer.xr.enabled = true;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        containerRef.current.appendChild(
            renderer.domElement
        );

        // -----------------------------------------
        // AR BUTTON
        // -----------------------------------------

        const arButton = ARButton.createButton(
            renderer,
            {
                requiredFeatures: ["hit-test"]
            }
        );

        document.body.appendChild(arButton);

        // -----------------------------------------
        // STORY ROOT
        // -----------------------------------------

        storyRoot = new THREE.Group();
        storyRoot.visible = false;

        scene.add(storyRoot);

        // -----------------------------------------
        // GLTF LOADER
        // -----------------------------------------

        const loader = new GLTFLoader();

        function loadModel(path) {
            return new Promise((resolve, reject) => {
                console.log("Loading:", path);

                loader.load(
                    path,

                    (gltf) => {
                        console.log(
                            "Loaded successfully:",
                            path
                        );

                        resolve(gltf.scene);
                    },

                    undefined,

                    (error) => {
                        console.error(
                            "FAILED TO LOAD:",
                            path,
                            error
                        );

                        reject(error);
                    }
                );
            });
        }

        // -----------------------------------------
        // LOAD ALL STORY SCENES
        // -----------------------------------------

        async function loadStory() {
            try {
                console.log(
                    "Loading all story scenes..."
                );

                // ---------------------------------
                // SCENE 1
                // ---------------------------------

                scene1Model = await loadModel(
                    "/models/Scene1.glb"
                );

                scene1Model.scale.setScalar(
                    0.1
                );

                scene1Model.visible = true;

                storyRoot.add(
                    scene1Model
                );

                console.log(
                    "Scene 1 ready."
                );

                // ---------------------------------
                // SCENE 2
                // ---------------------------------

                scene2Model = await loadModel(
                    "/models/Scene2.glb"
                );

                scene2Model.scale.setScalar(
                    0.1
                );

                scene2Model.visible = false;

                storyRoot.add(
                    scene2Model
                );

                console.log(
                    "Scene 2 ready."
                );

                // ---------------------------------
                // SCENE 3
                // ---------------------------------

                scene3Model = await loadModel(
                    "/models/Scene3.glb"
                );

                scene3Model.scale.setScalar(
                    0.1
                );

                scene3Model.visible = false;

                storyRoot.add(
                    scene3Model
                );

                console.log(
                    "Scene 3 ready."
                );

                // ---------------------------------
                // SCENE 4
                // ---------------------------------

                scene4Model = await loadModel(
                    "/models/Scene4.glb"
                );

                scene4Model.scale.setScalar(
                    0.1
                );

                scene4Model.visible = false;

                storyRoot.add(
                    scene4Model
                );

                console.log(
                    "Scene 4 ready."
                );

                // ---------------------------------
                // READY
                // ---------------------------------

                modelsReady = true;

                console.log(
                    "ALL 4 SCENES READY FOR AR"
                );
            }
            catch (error) {
                console.error(
                    "STORY LOAD FAILED:",
                    error
                );
            }
        }

        loadStory();

        // -----------------------------------------
        // RETICLE
        // -----------------------------------------

        const ringGeometry = new THREE.RingGeometry(
            0.08,
            0.1,
            32
        );

        ringGeometry.rotateX(
            -Math.PI / 2
        );

        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff
        });

        reticle = new THREE.Mesh(
            ringGeometry,
            ringMaterial
        );

        reticle.matrixAutoUpdate = false;
        reticle.visible = false;

        scene.add(reticle);

        // -----------------------------------------
        // TAP TO PLACE
        // -----------------------------------------

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {
                console.log(
                    "AR select detected"
                );

                console.log(
                    "reticle visible:",
                    reticle.visible
                );

                console.log(
                    "storyPlaced:",
                    storyPlaced
                );

                console.log(
                    "modelsReady:",
                    modelsReady
                );

                if (!reticle.visible) {
                    console.log(
                        "Placement blocked: reticle not visible."
                    );
                    return;
                }

                if (storyPlaced) {
                    console.log(
                        "Placement blocked: story already placed."
                    );
                    return;
                }

                if (!modelsReady) {
                    console.log(
                        "Placement blocked: scenes not loaded."
                    );
                    return;
                }

                const placementPosition =
                    new THREE.Vector3();

                placementPosition
                    .setFromMatrixPosition(
                        reticle.matrix
                    );

                // Place whole story.
                storyRoot.position.copy(
                    placementPosition
                );

                storyRoot.rotation.set(
                    0,
                    0,
                    0
                );

                storyRoot.visible = true;

                // ---------------------------------
                // ONLY SCENE 1 VISIBLE
                // ---------------------------------

                if (scene1Model) {
                    scene1Model.visible = true;
                }

                if (scene2Model) {
                    scene2Model.visible = false;
                }

                if (scene3Model) {
                    scene3Model.visible = false;
                }

                if (scene4Model) {
                    scene4Model.visible = false;
                }

                storyPlaced = true;

                reticle.visible = false;

                console.log(
                    "STORY PLACED - SCENE 1 ONLY"
                );
            }
        );

        scene.add(controller);

        // -----------------------------------------
        // WEBXR LOOP
        // -----------------------------------------

        function render(timestamp, frame) {
            if (frame) {
                const referenceSpace =
                    renderer.xr.getReferenceSpace();

                const session =
                    renderer.xr.getSession();

                // ---------------------------------
                // REQUEST HIT TEST
                // ---------------------------------

                if (!hitTestSourceRequested) {
                    session
                        .requestReferenceSpace(
                            "viewer"
                        )
                        .then(
                            (viewerSpace) => {
                                return session.requestHitTestSource({
                                    space: viewerSpace
                                });
                            }
                        )
                        .then(
                            (source) => {
                                hitTestSource =
                                    source;

                                console.log(
                                    "Hit test source ready."
                                );
                            }
                        )
                        .catch(
                            (error) => {
                                console.error(
                                    "Hit test source failed:",
                                    error
                                );
                            }
                        );

                    session.addEventListener(
                        "end",
                        () => {
                            hitTestSourceRequested =
                                false;

                            hitTestSource =
                                null;

                            storyPlaced =
                                false;

                            if (storyRoot) {
                                storyRoot.visible =
                                    false;
                            }
                        }
                    );

                    hitTestSourceRequested =
                        true;
                }

                // ---------------------------------
                // FLOOR DETECTION
                // ---------------------------------

                if (
                    hitTestSource &&
                    !storyPlaced
                ) {
                    const results =
                        frame.getHitTestResults(
                            hitTestSource
                        );

                    if (
                        results.length > 0
                    ) {
                        const hit =
                            results[0];

                        const pose =
                            hit.getPose(
                                referenceSpace
                            );

                        if (pose) {
                            reticle.visible =
                                true;

                            reticle.matrix.fromArray(
                                pose.transform.matrix
                            );
                        }
                    }
                    else {
                        reticle.visible =
                            false;
                    }
                }
            }

            renderer.render(
                scene,
                camera
            );
        }

        renderer.setAnimationLoop(
            render
        );

        // -----------------------------------------
        // RESIZE
        // -----------------------------------------

        function onResize() {
            camera.aspect =
                window.innerWidth /
                window.innerHeight;

            camera.updateProjectionMatrix();

            renderer.setSize(
                window.innerWidth,
                window.innerHeight
            );
        }

        window.addEventListener(
            "resize",
            onResize
        );

        // -----------------------------------------
        // CLEANUP
        // -----------------------------------------

        return () => {
            window.removeEventListener(
                "resize",
                onResize
            );

            renderer.setAnimationLoop(
                null
            );

            if (
                renderer.domElement &&
                renderer.domElement.parentNode
            ) {
                renderer.domElement.parentNode.removeChild(
                    renderer.domElement
                );
            }

            if (
                arButton &&
                arButton.parentNode
            ) {
                arButton.parentNode.removeChild(
                    arButton
                );
            }

            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                background: "black"
            }}
        />
    );
}