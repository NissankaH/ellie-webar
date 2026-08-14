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

        let environmentModel = null;
        let environmentPlaced = false;

        // ---------------------------------------------
        // SCENE
        // ---------------------------------------------

        scene = new THREE.Scene();

        // ---------------------------------------------
        // CAMERA
        // ---------------------------------------------

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            50
        );

        // ---------------------------------------------
        // LIGHTS
        // ---------------------------------------------

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

        // ---------------------------------------------
        // RENDERER
        // ---------------------------------------------

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

        // ---------------------------------------------
        // AR BUTTON
        // ---------------------------------------------

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

        // ---------------------------------------------
        // LOAD ENVIRONMENT
        // ---------------------------------------------

        const loader = new GLTFLoader();

        loader.load(
            "/models/environment.glb",

            (gltf) => {
                environmentModel = gltf.scene;

                // IMPORTANT:
                // Start hidden.
                // It only appears after floor placement.
                environmentModel.visible = false;

                // Start with a small scale because
                // Unity -> FBX -> Blender can produce
                // unexpected real-world scale.
                environmentModel.scale.set(
                    0.1,
                    0.1,
                    0.1
                );

                scene.add(
                    environmentModel
                );

                console.log(
                    "Environment loaded successfully."
                );
            },

            (progress) => {
                if (progress.total > 0) {
                    const percent =
                        (
                            progress.loaded /
                            progress.total
                        ) * 100;

                    console.log(
                        `Environment loading: ${percent.toFixed(0)}%`
                    );
                }
            },

            (error) => {
                console.error(
                    "Failed to load environment.glb:",
                    error
                );
            }
        );

        // ---------------------------------------------
        // RETICLE
        // ---------------------------------------------

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

        // ---------------------------------------------
        // CONTROLLER / TAP
        // ---------------------------------------------

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {
                if (
                    !reticle.visible ||
                    environmentPlaced ||
                    environmentModel === null
                ) {
                    return;
                }

                // Get reticle position.
                const placementPosition =
                    new THREE.Vector3();

                placementPosition
                    .setFromMatrixPosition(
                        reticle.matrix
                    );

                // Put whole environment there.
                environmentModel.position.copy(
                    placementPosition
                );

                // Keep environment upright.
                environmentModel.rotation.set(
                    0,
                    0,
                    0
                );

                environmentModel.visible = true;

                environmentPlaced = true;

                reticle.visible = false;

                console.log(
                    "Environment placed."
                );
            }
        );

        scene.add(controller);

        // ---------------------------------------------
        // WEBXR RENDER LOOP
        // ---------------------------------------------

        function render(
            timestamp,
            frame
        ) {
            if (frame) {
                const referenceSpace =
                    renderer.xr.getReferenceSpace();

                const session =
                    renderer.xr.getSession();

                // -------------------------------------
                // REQUEST HIT TEST
                // -------------------------------------

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
                            }
                        );

                    session.addEventListener(
                        "end",
                        () => {
                            hitTestSourceRequested =
                                false;

                            hitTestSource =
                                null;

                            environmentPlaced =
                                false;

                            if (
                                environmentModel
                            ) {
                                environmentModel.visible =
                                    false;
                            }
                        }
                    );

                    hitTestSourceRequested =
                        true;
                }

                // -------------------------------------
                // FLOOR HIT TEST
                // -------------------------------------

                if (
                    hitTestSource &&
                    !environmentPlaced
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
                    } else {
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

        // ---------------------------------------------
        // RESIZE
        // ---------------------------------------------

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

        // ---------------------------------------------
        // CLEANUP
        // ---------------------------------------------

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