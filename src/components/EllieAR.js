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
        let modelsReady = false;

        let introPlaying = false;
        let introFinished = false;

        const clock = new THREE.Clock();

        // ==================================================
        // SCENE
        // ==================================================

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            50
        );

        // ==================================================
        // LIGHTS
        // ==================================================

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

        // ==================================================
        // RENDERER
        // ==================================================

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

        renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        containerRef.current.appendChild(
            renderer.domElement
        );

        // ==================================================
        // AR BUTTON
        // ==================================================

        const arButton = ARButton.createButton(
            renderer,
            {
                requiredFeatures: [
                    "hit-test"
                ]
            }
        );

        document.body.appendChild(
            arButton
        );

        // ==================================================
        // STORY ROOT
        // ==================================================

        storyRoot = new THREE.Group();

        storyRoot.visible = false;

        scene.add(storyRoot);

        // ==================================================
        // GLTF LOADER
        // ==================================================

        const loader = new GLTFLoader();

        function loadGLB(path) {
            return new Promise(
                (resolve, reject) => {
                    loader.load(
                        path,

                        (gltf) => {
                            resolve(gltf);
                        },

                        undefined,

                        (error) => {
                            reject(error);
                        }
                    );
                }
            );
        }

        // ==================================================
        // LOAD EVERYTHING
        // ==================================================

        async function loadStory() {
            try {
                console.log(
                    "Loading Ellie story..."
                );

                const [
                    scene1GLB,
                    scene2GLB,
                    scene3GLB,
                    scene4GLB,
                    ellieGLB
                ] = await Promise.all([
                    loadGLB(
                        "/models/Scene1.glb"
                    ),

                    loadGLB(
                        "/models/Scene2.glb"
                    ),

                    loadGLB(
                        "/models/Scene3.glb"
                    ),

                    loadGLB(
                        "/models/Scene4.glb"
                    ),

                    loadGLB(
                        "/models/Ellie.glb"
                    )
                ]);

                // ==========================================
                // ENVIRONMENT
                // ==========================================

                scene1Model =
                    scene1GLB.scene;

                scene2Model =
                    scene2GLB.scene;

                scene3Model =
                    scene3GLB.scene;

                scene4Model =
                    scene4GLB.scene;

                // IMPORTANT:
                // Keep same scale for all scene pieces.

                const environmentScale = 0.1;

                scene1Model.scale.setScalar(
                    environmentScale
                );

                scene2Model.scale.setScalar(
                    environmentScale
                );

                scene3Model.scale.setScalar(
                    environmentScale
                );

                scene4Model.scale.setScalar(
                    environmentScale
                );

                // Scene progression.

                scene1Model.visible = true;
                scene2Model.visible = false;
                scene3Model.visible = false;
                scene4Model.visible = false;

                storyRoot.add(scene1Model);
                storyRoot.add(scene2Model);
                storyRoot.add(scene3Model);
                storyRoot.add(scene4Model);

                // ==========================================
                // ELLIE
                // ==========================================

                ellieModel =
                    ellieGLB.scene;

                // Start with the same scale.
                //
                // We can adjust this separately
                // after seeing it on the phone.

                ellieModel.scale.setScalar(
                    0.1
                );

                // Start Ellie at StoryRoot origin.
                //
                // We'll adjust this after checking
                // where she appears relative to Scene 1.

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

                // ==========================================
                // ELLIE ANIMATION
                // ==========================================

                if (
                    ellieGLB.animations &&
                    ellieGLB.animations.length > 0
                ) {
                    console.log(
                        "Ellie animations found:",
                        ellieGLB.animations.map(
                            (clip) => clip.name
                        )
                    );

                    ellieMixer =
                        new THREE.AnimationMixer(
                            ellieModel
                        );

                    // For now use the FIRST animation
                    // contained in Ellie.glb.

                    ellieWalkAction =
                        ellieMixer.clipAction(
                            ellieGLB.animations[0]
                        );

                    // Make sure the walk loops.

                    ellieWalkAction.setLoop(
                        THREE.LoopRepeat,
                        Infinity
                    );

                    // Prepare it but DON'T actually
                    // let Ellie walk yet.

                    ellieWalkAction.play();

                    ellieWalkAction.paused =
                        true;

                    console.log(
                        "Ellie animation prepared:",
                        ellieGLB.animations[0].name
                    );
                }
                else {
                    console.warn(
                        "Ellie.glb contains no animations."
                    );
                }

                // ==========================================
                // READY
                // ==========================================

                modelsReady = true;

                console.log(
                    "Scenes + Ellie loaded."
                );
            }
            catch (error) {
                console.error(
                    "Failed to load Ellie story:",
                    error
                );
            }
        }

        loadStory();

        // ==================================================
        // RETICLE
        // ==================================================

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

        reticle =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );

        reticle.matrixAutoUpdate = false;

        reticle.visible = false;

        scene.add(reticle);

        // ==================================================
        // VOICE #1
        // ==================================================

        function playIntroduction() {
            if (
                introPlaying ||
                introFinished
            ) {
                return;
            }

            introPlaying = true;

            const audio =
                new Audio(
                    "/audio/1.mp3"
                );

            audio.preload = "auto";

            console.log(
                "Playing Voice #1"
            );

            audio.play()
                .then(() => {
                    console.log(
                        "Voice #1 started."
                    );
                })
                .catch((error) => {
                    console.error(
                        "Voice #1 failed:",
                        error
                    );

                    introPlaying = false;
                });

            audio.addEventListener(
                "ended",
                () => {
                    introPlaying = false;
                    introFinished = true;

                    console.log(
                        "Voice #1 finished."
                    );

                    // NEXT STEP:
                    // Footprints become tappable here.
                }
            );
        }

        // ==================================================
        // TAP TO PLACE STORY
        // ==================================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {
                if (
                    !reticle.visible ||
                    storyPlaced ||
                    !modelsReady
                ) {
                    return;
                }

                const placementPosition =
                    new THREE.Vector3();

                placementPosition
                    .setFromMatrixPosition(
                        reticle.matrix
                    );

                // Place the whole StoryRoot.

                storyRoot.position.copy(
                    placementPosition
                );

                storyRoot.rotation.set(
                    0,
                    0,
                    0
                );

                storyRoot.visible = true;

                storyPlaced = true;

                reticle.visible = false;

                console.log(
                    "Story placed!"
                );

                // ==========================================
                // PLAY SINHALA VOICE #1
                // ==========================================

                playIntroduction();
            }
        );

        scene.add(controller);

        // ==================================================
        // RENDER LOOP
        // ==================================================

        function render(
            timestamp,
            frame
        ) {
            // ----------------------------------------------
            // UPDATE ELLIE ANIMATION
            // ----------------------------------------------

            const delta =
                clock.getDelta();

            if (ellieMixer) {
                ellieMixer.update(
                    delta
                );
            }

            // ----------------------------------------------
            // WEBXR HIT TEST
            // ----------------------------------------------

            if (frame) {
                const referenceSpace =
                    renderer.xr.getReferenceSpace();

                const session =
                    renderer.xr.getSession();

                if (
                    !hitTestSourceRequested
                ) {
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

                            introPlaying =
                                false;

                            introFinished =
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

                        reticle.visible =
                            true;

                        reticle.matrix.fromArray(
                            pose.transform.matrix
                        );
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

        // ==================================================
        // RESIZE
        // ==================================================

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

        // ==================================================
        // CLEANUP
        // ==================================================

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
                renderer.domElement.parentNode
                    .removeChild(
                        renderer.domElement
                    );
            }

            if (
                arButton &&
                arButton.parentNode
            ) {
                arButton.parentNode
                    .removeChild(
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