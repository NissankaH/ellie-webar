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

        let storyRoot;

        let scene1Model = null;
        let scene2Model = null;
        let scene3Model = null;
        let scene4Model = null;

        let ellieModel = null;
        let ellieMixer = null;
        let ellieWalkAction = null;

        let storyPlaced = false;
        let scenesReady = false;
        let ellieReady = false;

        let currentAudio = null;

        const clock = new THREE.Clock();

        // =========================================
        // THREE SCENE
        // =========================================

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            50
        );

        // =========================================
        // LIGHTING
        // =========================================

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

        directionalLight.position.set(2, 4, 2);

        scene.add(directionalLight);

        // =========================================
        // RENDERER
        // =========================================

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
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

        // =========================================
        // AR BUTTON
        // =========================================

        const arButton = ARButton.createButton(
            renderer,
            {
                requiredFeatures: ["hit-test"]
            }
        );

        document.body.appendChild(arButton);

        // =========================================
        // STORY ROOT
        // =========================================

        storyRoot = new THREE.Group();

        storyRoot.visible = false;

        scene.add(storyRoot);

        // =========================================
        // GLTF LOADER
        // =========================================

        const loader = new GLTFLoader();

        function loadGLB(path) {
            return new Promise((resolve, reject) => {
                console.log("Loading:", path);

                loader.load(
                    path,

                    (gltf) => {
                        console.log(
                            "Loaded:",
                            path
                        );

                        resolve(gltf);
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

        // =========================================
        // LOAD ENVIRONMENT SCENES
        // =========================================

        async function loadScenes() {
            try {
                console.log(
                    "Loading Scene 1..."
                );

                const gltf1 = await loadGLB(
                    "/models/Scene1.glb"
                );

                scene1Model = gltf1.scene;
                scene1Model.scale.setScalar(0.1);
                scene1Model.visible = true;

                storyRoot.add(scene1Model);

                // -----------------------------

                console.log(
                    "Loading Scene 2..."
                );

                const gltf2 = await loadGLB(
                    "/models/Scene2.glb"
                );

                scene2Model = gltf2.scene;
                scene2Model.scale.setScalar(0.1);
                scene2Model.visible = false;

                storyRoot.add(scene2Model);

                // -----------------------------

                console.log(
                    "Loading Scene 3..."
                );

                const gltf3 = await loadGLB(
                    "/models/Scene3.glb"
                );

                scene3Model = gltf3.scene;
                scene3Model.scale.setScalar(0.1);
                scene3Model.visible = false;

                storyRoot.add(scene3Model);

                // -----------------------------

                console.log(
                    "Loading Scene 4..."
                );

                const gltf4 = await loadGLB(
                    "/models/Scene4.glb"
                );

                scene4Model = gltf4.scene;
                scene4Model.scale.setScalar(0.1);
                scene4Model.visible = false;

                storyRoot.add(scene4Model);

                // -----------------------------

                scenesReady = true;

                console.log(
                    "ALL ENVIRONMENT SCENES READY"
                );
            }
            catch (error) {
                console.error(
                    "Environment loading failed:",
                    error
                );
            }
        }

        // =========================================
        // LOAD ELLIE SEPARATELY
        // =========================================

        async function loadEllie() {
            try {
                console.log(
                    "Loading Ellie separately..."
                );

                const ellieGLB = await loadGLB(
                    "/models/Ellie.glb"
                );

                ellieModel = ellieGLB.scene;

                // We'll tune these after seeing her.
                ellieModel.scale.setScalar(0.1);

                ellieModel.position.set(
                    0,
                    0,
                    0
                );

                ellieModel.rotation.set(
                    0,
                    0,
                    0
                );

                storyRoot.add(
                    ellieModel
                );

                // ---------------------------------
                // ANIMATIONS
                // ---------------------------------

                if (
                    ellieGLB.animations &&
                    ellieGLB.animations.length > 0
                ) {
                    console.log(
                        "Ellie animations:",
                        ellieGLB.animations.map(
                            (clip) => clip.name
                        )
                    );

                    ellieMixer =
                        new THREE.AnimationMixer(
                            ellieModel
                        );

                    // For now use first animation.
                    ellieWalkAction =
                        ellieMixer.clipAction(
                            ellieGLB.animations[0]
                        );

                    ellieWalkAction.setLoop(
                        THREE.LoopRepeat,
                        Infinity
                    );

                    ellieWalkAction.play();

                    // Ellie should stand still for intro.
                    ellieWalkAction.paused = true;

                    console.log(
                        "Ellie animation prepared."
                    );
                }
                else {
                    console.warn(
                        "Ellie loaded but NO animation was found."
                    );
                }

                ellieReady = true;

                console.log(
                    "ELLIE READY"
                );
            }
            catch (error) {
                // IMPORTANT:
                // This does NOT stop the environment.
                console.error(
                    "ELLIE FAILED TO LOAD."
                );

                console.error(error);

                ellieReady = false;
            }
        }

        loadScenes();
        loadEllie();

        // =========================================
        // AUDIO
        // =========================================

        function playVoice(number, onFinished = null) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }

            currentAudio = new Audio(
                `/audio/${number}.mp3`
            );

            currentAudio.preload = "auto";

            currentAudio.onended = () => {
                console.log(
                    `Voice ${number} finished.`
                );

                if (onFinished) {
                    onFinished();
                }
            };

            currentAudio.onerror = () => {
                console.error(
                    `Could not load audio/${number}.mp3`
                );
            };

            currentAudio
                .play()
                .then(() => {
                    console.log(
                        `Voice ${number} playing.`
                    );
                })
                .catch((error) => {
                    console.error(
                        `Voice ${number} could not play:`,
                        error
                    );
                });
        }

        // =========================================
        // RETICLE
        // =========================================

        const ringGeometry =
            new THREE.RingGeometry(
                0.08,
                0.1,
                32
            );

        ringGeometry.rotateX(
            -Math.PI / 2
        );

        const ringMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            });

        reticle = new THREE.Mesh(
            ringGeometry,
            ringMaterial
        );

        reticle.matrixAutoUpdate = false;
        reticle.visible = false;

        scene.add(reticle);

        // =========================================
        // PLACE STORY
        // =========================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {
                if (!reticle.visible) {
                    return;
                }

                if (storyPlaced) {
                    return;
                }

                // IMPORTANT:
                // We ONLY require environment scenes.
                // Ellie is not allowed to block placement.

                if (!scenesReady) {
                    console.log(
                        "Waiting for environment..."
                    );

                    return;
                }

                const placementPosition =
                    new THREE.Vector3();

                placementPosition
                    .setFromMatrixPosition(
                        reticle.matrix
                    );

                storyRoot.position.copy(
                    placementPosition
                );

                storyRoot.rotation.set(
                    0,
                    0,
                    0
                );

                // ---------------------------------
                // INITIAL STORY STATE
                // ---------------------------------

                scene1Model.visible = true;
                scene2Model.visible = false;
                scene3Model.visible = false;
                scene4Model.visible = false;

                storyRoot.visible = true;

                storyPlaced = true;

                reticle.visible = false;

                console.log(
                    "STORY PLACED"
                );

                console.log(
                    "Ellie ready:",
                    ellieReady
                );

                // ---------------------------------
                // VOICE #1
                // ---------------------------------

                playVoice(
                    1,

                    () => {
                        console.log(
                            "INTRO COMPLETE"
                        );

                        // NEXT:
                        // enable footprint interaction here.
                    }
                );
            }
        );

        scene.add(controller);

        // =========================================
        // RENDER LOOP
        // =========================================

        function render(timestamp, frame) {
            const delta =
                clock.getDelta();

            // Update Ellie animation system.
            if (ellieMixer) {
                ellieMixer.update(delta);
            }

            if (frame) {
                const referenceSpace =
                    renderer.xr.getReferenceSpace();

                const session =
                    renderer.xr.getSession();

                // ---------------------------------
                // HIT TEST SETUP
                // ---------------------------------

                if (!hitTestSourceRequested) {
                    session
                        .requestReferenceSpace(
                            "viewer"
                        )
                        .then(
                            (viewerSpace) => {
                                return session
                                    .requestHitTestSource({
                                        space:
                                            viewerSpace
                                    });
                            }
                        )
                        .then(
                            (source) => {
                                hitTestSource =
                                    source;

                                console.log(
                                    "Hit test ready."
                                );
                            }
                        )
                        .catch(
                            (error) => {
                                console.error(
                                    "Hit test failed:",
                                    error
                                );
                            }
                        );

                    session.addEventListener(
                        "end",
                        () => {
                            hitTestSourceRequested =
                                false;

                            hitTestSource = null;

                            storyPlaced = false;

                            if (storyRoot) {
                                storyRoot.visible =
                                    false;
                            }

                            if (currentAudio) {
                                currentAudio.pause();

                                currentAudio.currentTime =
                                    0;
                            }
                        }
                    );

                    hitTestSourceRequested = true;
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

        // =========================================
        // RESIZE
        // =========================================

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

        // =========================================
        // CLEANUP
        // =========================================

        return () => {
            window.removeEventListener(
                "resize",
                onResize
            );

            renderer.setAnimationLoop(
                null
            );

            if (currentAudio) {
                currentAudio.pause();
            }

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