"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function EllieAR() {
    const containerRef = useRef(null);

    useEffect(() => {

        // ============================================================
        // SETTINGS
        // ============================================================

        const WORLD_SCALE = 2.85;

        // Keep Ellie very slow and gentle.
        const ELLIE_WALK_SPEED = 0.009;

        // Ellie faces forward.
        const ELLIE_ROTATION_OFFSET = -90;

        // Log animation timing.
        const LOG_LIFT_DURATION = 1.0;
        const LOG_SIDE_DURATION = 1.5;

        // How high the log rises before moving to the corner.
        const LOG_LIFT_HEIGHT = 0.08;

        // Wait after log is moved before Scene 3.
        const SCENE3_DELAY = 2000;

        // Bridge log movement duration.
        const BRIDGE_LOG_MOVE_DURATION = 1.5;

        const TAP_DEBOUNCE_MS = 350;

        // ============================================================
        // THREE / XR
        // ============================================================

        let scene;
        let camera;
        let renderer;
        let controller;
        let reticle;

        let hitTestSource = null;
        let hitTestSourceRequested = false;

        const clock = new THREE.Clock();

        // ============================================================
        // STORY ROOT
        // ============================================================

        let storyRoot = null;

        // ============================================================
        // SCENES
        // ============================================================

        let scene1Model = null;
        let scene2Model = null;
        let scene3Model = null;
        let scene4Model = null;

        // ============================================================
        // ELLIE
        // ============================================================

        let ellieModel = null;
        let ellieMixer = null;
        let ellieWalkAction = null;

        let ellieMovement = null;

        // ============================================================
        // OBJECT MOVEMENT
        // ============================================================

        let objectMovement = null;

        // ============================================================
        // SCENE 1
        // ============================================================

        let finalFootprintTarget = null;

        // ============================================================
        // SCENE 2
        // ============================================================

        // Hidden guide used AFTER log sequence.
        let scene2Footp4Target = null;

        // Actual physical log.
        let logLiftObject = null;

        // Ellie walks here when Scene 2 interaction starts.
        let logLiftTarget = null;

        // Actual log ends here.
        let logSideTarget = null;

        // ============================================================
        // SCENE 3
        // ============================================================

        let sourceLogs = [];
        let bridgeLogs = [];

        let bridgeStartTarget = null;
        let bridgePlaceTarget = null;
        let logPileTarget = null;
        let riverTarget = null;
        let returnTarget = null;

        // ============================================================
        // SCENE 4
        // ============================================================

        let finalTarget = null;

        // ============================================================
        // STATE
        // ============================================================

        let scenesReady = false;
        let storyPlaced = false;

        let storyStage = "WAITING";

        let interactionLocked = true;
        let sequenceRunning = false;

        let bridgeLogIndex = 0;

        let currentAudio = null;

        let lastTapTime = 0;

        // ============================================================
        // CREATE THREE SCENE
        // ============================================================

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            100
        );

        // ============================================================
        // LIGHTING
        // ============================================================

        const hemisphereLight =
            new THREE.HemisphereLight(
                0xffffff,
                0x444444,
                3
            );

        scene.add(
            hemisphereLight
        );

        const directionalLight =
            new THREE.DirectionalLight(
                0xffffff,
                2
            );

        directionalLight.position.set(
            2,
            4,
            2
        );

        scene.add(
            directionalLight
        );

        // ============================================================
        // RENDERER
        // ============================================================

        renderer =
            new THREE.WebGLRenderer({
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

        // ============================================================
        // AR BUTTON
        // ============================================================

        const arButton =
            ARButton.createButton(
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

        // ============================================================
        // STORY ROOT
        // ============================================================

        storyRoot =
            new THREE.Group();

        storyRoot.scale.setScalar(
            WORLD_SCALE
        );

        storyRoot.visible = false;

        scene.add(
            storyRoot
        );

        // ============================================================
        // LOADER
        // ============================================================

        const loader =
            new GLTFLoader();

        function loadGLB(path) {

            return new Promise(
                (resolve, reject) => {

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
                                "FAILED:",
                                path,
                                error
                            );

                            reject(error);
                        }
                    );
                }
            );
        }

        // ============================================================
        // NAME HELPERS
        // ============================================================

        function normalizeName(name) {

            return (name || "")
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );
        }

        function findExact(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ) === wanted
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        function findContaining(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ).includes(
                            wanted
                        )
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        function findExactMesh(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found ||
                        !child.isMesh
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ) === wanted
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        // ============================================================
        // POSITION HELPERS
        // ============================================================

        function getWorldPosition(
            object
        ) {

            if (!object) {
                return null;
            }

            const world =
                new THREE.Vector3();

            object.getWorldPosition(
                world
            );

            return world;
        }

        function getMeshCenterWorld(
            object
        ) {

            if (!object) {
                return null;
            }

            if (object.isMesh) {

                const box =
                    new THREE.Box3()
                        .setFromObject(
                            object
                        );

                if (!box.isEmpty()) {

                    const center =
                        new THREE.Vector3();

                    box.getCenter(
                        center
                    );

                    return center;
                }
            }

            return getWorldPosition(
                object
            );
        }

        // ============================================================
        // MOVEMENT SAFETY
        // ============================================================

        function isUnsafeMovementObject(
            object
        ) {

            return (
                !object ||
                object === storyRoot ||
                object === scene1Model ||
                object === scene2Model ||
                object === scene3Model ||
                object === scene4Model
            );
        }

        // ============================================================
        // LOAD ENVIRONMENT
        // ============================================================

        async function loadEnvironment() {

            try {

                // ====================================================
                // SCENE 1
                // ====================================================

                const gltf1 =
                    await loadGLB(
                        "/models/Scene1.glb"
                    );

                scene1Model =
                    gltf1.scene;

                scene1Model.scale.setScalar(
                    0.1
                );

                scene1Model.visible =
                    true;

                storyRoot.add(
                    scene1Model
                );

                scene1Model.traverse(
                    (child) => {

                        if (
                            normalizeName(
                                child.name
                            ) === "footp41"
                        ) {

                            finalFootprintTarget =
                                child;
                        }
                    }
                );

                console.log(
                    "SCENE 1 FINAL FOOTPRINT:",
                    finalFootprintTarget?.name
                );

                // ====================================================
                // SCENE 2
                // ====================================================

                const gltf2 =
                    await loadGLB(
                        "/models/Scene2.glb"
                    );

                scene2Model =
                    gltf2.scene;

                scene2Model.scale.setScalar(
                    0.1
                );

                scene2Model.visible =
                    false;

                storyRoot.add(
                    scene2Model
                );

                // ====================================================
                // HIDDEN FOOTP4 TARGET
                // ====================================================

                scene2Model.traverse(
                    (child) => {

                        const name =
                            normalizeName(
                                child.name
                            );

                        if (
                            name === "footp4"
                        ) {

                            if (
                                !scene2Footp4Target
                            ) {

                                scene2Footp4Target =
                                    child;
                            }

                            // Navigation guide only.
                            child.visible =
                                false;
                        }
                    }
                );

                // ====================================================
                // ACTUAL LOG
                // ====================================================

                logLiftObject =
                    findExactMesh(
                        scene2Model,
                        "Log_Lift"
                    );

                // Fallback:
                // still ONLY accept a mesh.
                if (!logLiftObject) {

                    scene2Model.traverse(
                        (child) => {

                            if (
                                logLiftObject ||
                                !child.isMesh
                            ) {

                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                name.includes(
                                    "loglift"
                                ) &&
                                !name.includes(
                                    "target"
                                )
                            ) {

                                logLiftObject =
                                    child;
                            }
                        }
                    );
                }

                // ====================================================
                // TARGET WHERE ELLIE STANDS
                // ====================================================

                logLiftTarget =
                    findExact(
                        scene2Model,
                        "logLiftTarget"
                    ) ||
                    findContaining(
                        scene2Model,
                        "logLiftTarget"
                    );

                // ====================================================
                // TARGET WHERE LOG ENDS
                // ====================================================

                logSideTarget =
                    findExact(
                        scene2Model,
                        "logSideTarget"
                    ) ||
                    findContaining(
                        scene2Model,
                        "logSideTarget"
                    );

                console.log(
                    "SCENE2 FOOTP4:",
                    scene2Footp4Target?.name
                );

                console.log(
                    "ACTUAL LOG OBJECT:",
                    logLiftObject?.name
                );

                console.log(
                    "LOG OBJECT TYPE:",
                    logLiftObject?.type
                );

                console.log(
                    "LOG PARENT:",
                    logLiftObject?.parent?.name
                );

                console.log(
                    "LOG LIFT TARGET:",
                    logLiftTarget?.name
                );

                console.log(
                    "LOG SIDE TARGET:",
                    logSideTarget?.name
                );

                // ====================================================
                // SCENE 3
                // ====================================================

                const gltf3 =
                    await loadGLB(
                        "/models/Scene3.glb"
                    );

                scene3Model =
                    gltf3.scene;

                scene3Model.scale.setScalar(
                    0.1
                );

                scene3Model.visible =
                    false;

                storyRoot.add(
                    scene3Model
                );

                // ====================================================
                // SOURCE LOGS
                // ====================================================

                sourceLogs = [];

                const sourceParent =
                    findExact(
                        scene3Model,
                        "SourceLogs"
                    ) ||
                    findContaining(
                        scene3Model,
                        "SourceLogs"
                    );

                if (sourceParent) {

                    const validNames = [
                        "log",
                        "log1",
                        "log2"
                    ];

                    sourceParent.traverse(
                        (child) => {

                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                validNames.includes(
                                    name
                                )
                            ) {

                                sourceLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                sourceLogs.sort(
                    (a, b) => {

                        const order = {
                            log: 0,
                            log1: 1,
                            log2: 2
                        };

                        return (
                            order[
                                normalizeName(
                                    a.name
                                )
                            ] -
                            order[
                                normalizeName(
                                    b.name
                                )
                            ]
                        );
                    }
                );

                // ====================================================
                // BRIDGE LOGS
                // ====================================================

                bridgeLogs = [];

                const bridgeParent =
                    findExact(
                        scene3Model,
                        "BridgeLogs"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgeLogs"
                    );

                if (bridgeParent) {

                    const validNames = [
                        "log3",
                        "log4",
                        "log5"
                    ];

                    bridgeParent.traverse(
                        (child) => {

                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                validNames.includes(
                                    name
                                )
                            ) {

                                bridgeLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                bridgeLogs.sort(
                    (a, b) => {

                        const order = {
                            log3: 0,
                            log4: 1,
                            log5: 2
                        };

                        return (
                            order[
                                normalizeName(
                                    a.name
                                )
                            ] -
                            order[
                                normalizeName(
                                    b.name
                                )
                            ]
                        );
                    }
                );

                bridgeLogs.forEach(
                    (log) => {

                        log.visible =
                            false;
                    }
                );

                // ====================================================
                // SCENE 3 TARGETS
                // ====================================================

                bridgeStartTarget =
                    findExact(
                        scene3Model,
                        "BridgeStartTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgeStartTarget"
                    );

                bridgePlaceTarget =
                    findExact(
                        scene3Model,
                        "BridgePlaceTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgePlaceTarget"
                    );

                logPileTarget =
                    findExact(
                        scene3Model,
                        "LogPileTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "LogPileTarget"
                    );

                riverTarget =
                    findExact(
                        scene3Model,
                        "RiverTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "RiverTarget"
                    );

                returnTarget =
                    findExact(
                        scene3Model,
                        "ReturnTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "ReturnTarget"
                    );

                // ====================================================
                // SCENE 4
                // ====================================================

                const gltf4 =
                    await loadGLB(
                        "/models/Scene4.glb"
                    );

                scene4Model =
                    gltf4.scene;

                scene4Model.scale.setScalar(
                    0.1
                );

                scene4Model.visible =
                    false;

                storyRoot.add(
                    scene4Model
                );

                finalTarget =
                    findExact(
                        scene4Model,
                        "FinalTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "FinalTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "MommyTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "EndTarget"
                    );

                scenesReady =
                    true;

                console.log(
                    "ALL SCENES READY"
                );
            }
            catch (error) {

                console.error(
                    "ENVIRONMENT ERROR:",
                    error
                );
            }
        }

        // ============================================================
        // LOAD ELLIE
        // ============================================================

        async function loadEllie() {

            try {

                const gltf =
                    await loadGLB(
                        "/models/Ellie.glb"
                    );

                ellieModel =
                    gltf.scene;

                ellieModel.scale.setScalar(
                    0.02
                );

                ellieModel.position.set(
                    0,
                    0,
                    0
                );

                storyRoot.add(
                    ellieModel
                );

                if (
                    gltf.animations &&
                    gltf.animations.length > 0
                ) {

                    ellieMixer =
                        new THREE.AnimationMixer(
                            ellieModel
                        );

                    ellieWalkAction =
                        ellieMixer.clipAction(
                            gltf.animations[0]
                        );

                    ellieWalkAction.setLoop(
                        THREE.LoopRepeat,
                        Infinity
                    );

                    ellieWalkAction.play();

                    ellieWalkAction.paused =
                        true;
                }

                console.log(
                    "ELLIE READY"
                );
            }
            catch (error) {

                console.error(
                    "ELLIE ERROR:",
                    error
                );
            }
        }

        loadEnvironment();
        loadEllie();

        // ============================================================
        // AUDIO
        // ============================================================

        function playVoice(number) {

            return new Promise(
                (resolve) => {

                    if (
                        currentAudio &&
                        !currentAudio.ended
                    ) {

                        currentAudio.pause();

                        currentAudio.currentTime =
                            0;
                    }

                    currentAudio =
                        new Audio(
                            `/audio/${number}.mp3`
                        );

                    currentAudio.preload =
                        "auto";

                    currentAudio.onended =
                        () => {

                            console.log(
                                `VOICE ${number} FINISHED`
                            );

                            resolve();
                        };

                    currentAudio.onerror =
                        () => {

                            console.error(
                                `VOICE ${number} FAILED`
                            );

                            resolve();
                        };

                    currentAudio
                        .play()
                        .catch(
                            () => {

                                resolve();
                            }
                        );
                }
            );
        }

        // ============================================================
        // DELAY HELPER
        // ============================================================

        function wait(ms) {

            return new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );
        }

        // ============================================================
        // WALK ANIMATION
        // ============================================================

        function startWalk() {

            if (ellieWalkAction) {

                ellieWalkAction.paused =
                    false;
            }
        }

        function stopWalk() {

            if (ellieWalkAction) {

                ellieWalkAction.paused =
                    true;
            }
        }

        // ============================================================
        // ELLIE MOVEMENT
        // ============================================================

        function moveEllieToWorld(
            worldPosition,
            speed = ELLIE_WALK_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        !ellieModel ||
                        !worldPosition
                    ) {

                        resolve();
                        return;
                    }

                    const destination =
                        storyRoot.worldToLocal(
                            worldPosition.clone()
                        );

                    destination.y =
                        ellieModel.position.y;

                    const distance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    if (
                        distance < 0.001
                    ) {

                        resolve();
                        return;
                    }

                    startWalk();

                    ellieMovement = {

                        destination:
                            destination,

                        speed:
                            speed,

                        resolve:
                            resolve
                    };
                }
            );
        }

        function moveEllieTo(
            target,
            speed = ELLIE_WALK_SPEED
        ) {

            if (!target) {

                console.warn(
                    "ELLIE TARGET MISSING"
                );

                return Promise.resolve();
            }

            return moveEllieToWorld(
                getWorldPosition(
                    target
                ),
                speed
            );
        }

        function updateEllieMovement(
            delta
        ) {

            if (
                !ellieMovement ||
                !ellieModel
            ) {

                return;
            }

            const direction =
                ellieMovement
                    .destination
                    .clone()
                    .sub(
                        ellieModel.position
                    );

            direction.y =
                0;

            const distance =
                direction.length();

            if (
                distance <=
                0.002
            ) {

                ellieModel.position.x =
                    ellieMovement.destination.x;

                ellieModel.position.z =
                    ellieMovement.destination.z;

                stopWalk();

                const finish =
                    ellieMovement.resolve;

                ellieMovement =
                    null;

                finish();

                return;
            }

            const angle =
                Math.atan2(
                    direction.x,
                    direction.z
                );

            ellieModel.rotation.y =
                angle +
                THREE.MathUtils.degToRad(
                    ELLIE_ROTATION_OFFSET
                );

            const amount =
                Math.min(
                    ellieMovement.speed *
                    delta,
                    distance
                );

            direction.normalize();

            ellieModel.position.addScaledVector(
                direction,
                amount
            );
        }

        // ============================================================
        // DURATION-BASED OBJECT MOVEMENT
        //
        // IMPORTANT:
        // This always finishes after duration seconds.
        // It cannot hang because of distance / scale.
        // ============================================================

        function animateObjectToWorld(
            object,
            worldDestination,
            duration
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        isUnsafeMovementObject(
                            object
                        ) ||
                        !worldDestination ||
                        !object.parent
                    ) {

                        console.warn(
                            "OBJECT MOVEMENT SKIPPED:",
                            object?.name
                        );

                        resolve();

                        return;
                    }

                    const localDestination =
                        object.parent.worldToLocal(
                            worldDestination.clone()
                        );

                    objectMovement = {

                        object:
                            object,

                        start:
                            object.position.clone(),

                        destination:
                            localDestination,

                        duration:
                            Math.max(
                                duration,
                                0.01
                            ),

                        elapsed:
                            0,

                        resolve:
                            resolve
                    };

                    console.log(
                        "OBJECT ANIMATION START:",
                        object.name,
                        objectMovement.start,
                        "->",
                        localDestination
                    );
                }
            );
        }

        function animateObjectToTarget(
            object,
            target,
            duration
        ) {

            if (!target) {

                console.warn(
                    "OBJECT TARGET MISSING"
                );

                return Promise.resolve();
            }

            return animateObjectToWorld(
                object,
                getWorldPosition(
                    target
                ),
                duration
            );
        }

        function updateObjectMovement(
            delta
        ) {

            if (!objectMovement) {
                return;
            }

            const movement =
                objectMovement;

            const object =
                movement.object;

            if (
                isUnsafeMovementObject(
                    object
                )
            ) {

                const finish =
                    movement.resolve;

                objectMovement =
                    null;

                finish();

                return;
            }

            movement.elapsed +=
                delta;

            let t =
                movement.elapsed /
                movement.duration;

            t =
                THREE.MathUtils.clamp(
                    t,
                    0,
                    1
                );

            // Smooth ease-in/ease-out.
            const eased =
                t * t * (3 - 2 * t);

            object.position.lerpVectors(
                movement.start,
                movement.destination,
                eased
            );

            if (
                t >= 1
            ) {

                object.position.copy(
                    movement.destination
                );

                const finish =
                    movement.resolve;

                objectMovement =
                    null;

                console.log(
                    "OBJECT ANIMATION COMPLETE:",
                    object.name
                );

                finish();
            }
        }

        // ============================================================
        // SAFE SCENE 3 FALLBACK
        //
        // Even if log animation somehow errors,
        // Scene 3 still proceeds.
        // ============================================================

        async function safeLogAction(
            actionPromise,
            maxMilliseconds
        ) {

            await Promise.race([

                actionPromise,

                wait(
                    maxMilliseconds
                )

            ]);
        }

        // ============================================================
        // INTRO
        // ============================================================

        async function runIntro() {

            interactionLocked =
                true;

            sequenceRunning =
                true;

            storyStage =
                "INTRO";

            await playVoice(1);

            storyStage =
                "FOOTPRINTS";

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // SCENE 1
        // ============================================================

        async function runScene1() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            const finalWorld =
                getMeshCenterWorld(
                    finalFootprintTarget
                );

            await Promise.all([

                playVoice(2),

                moveEllieToWorld(
                    finalWorld,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // Scene 2 comes in.
            scene2Model.visible =
                true;

            // Hidden navigation guide remains hidden.
            if (scene2Footp4Target) {

                scene2Footp4Target.visible =
                    false;
            }

            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // SCENE 2
        // ============================================================

        async function runScene2() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "LOG_ACTION";

            console.log(
                "SCENE 2 LOG SEQUENCE START"
            );

            // Start voice 4.
            const voice4 =
                playVoice(4);

            // ========================================================
            // 1. ELLIE GOES TO LOG LIFT TARGET
            // ========================================================

            if (logLiftTarget) {

                console.log(
                    "ELLIE -> logLiftTarget"
                );

                await moveEllieTo(
                    logLiftTarget,
                    ELLIE_WALK_SPEED
                );
            }
            else {

                console.error(
                    "logLiftTarget NOT FOUND"
                );
            }

            stopWalk();

            await wait(300);

            // ========================================================
            // 2. ACTUAL LOG RISES
            // ========================================================

            if (
                logLiftObject &&
                !isUnsafeMovementObject(
                    logLiftObject
                )
            ) {

                const logWorld =
                    getWorldPosition(
                        logLiftObject
                    );

                const raisedPosition =
                    logWorld.clone();

                raisedPosition.y +=
                    LOG_LIFT_HEIGHT;

                console.log(
                    "LIFTING:",
                    logLiftObject.name
                );

                // Maximum 2 seconds before continuing.
                await safeLogAction(

                    animateObjectToWorld(
                        logLiftObject,
                        raisedPosition,
                        LOG_LIFT_DURATION
                    ),

                    2000
                );
            }
            else {

                console.error(
                    "VALID Log_Lift MESH NOT FOUND"
                );
            }

            await wait(400);

            // ========================================================
            // 3. LOG MOVES TO logSideTarget
            // ========================================================

            if (
                logLiftObject &&
                logSideTarget &&
                !isUnsafeMovementObject(
                    logLiftObject
                )
            ) {

                console.log(
                    "LOG -> logSideTarget"
                );

                // Maximum 2.5 seconds.
                await safeLogAction(

                    animateObjectToTarget(
                        logLiftObject,
                        logSideTarget,
                        LOG_SIDE_DURATION
                    ),

                    2500
                );
            }
            else {

                console.error(
                    "LOG SIDE MOVE MISSING:",
                    {
                        log:
                            logLiftObject?.name,

                        target:
                            logSideTarget?.name
                    }
                );
            }

            console.log(
                "LOG SECTION COMPLETE"
            );

            // Voice 4 can finish normally,
            // but don't let progression depend forever on it.
            await Promise.race([

                voice4,

                wait(5000)

            ]);

            // ========================================================
            // 4. PAUSE BEFORE NEXT SCENE
            // ========================================================

            await wait(
                SCENE3_DELAY
            );

            // ========================================================
            // 5. SCENE 3 MUST APPEAR
            // ========================================================

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 VISIBLE"
            );

            // ========================================================
            // 6. ELLIE GOES TO HIDDEN footp4
            // ========================================================

            if (scene2Footp4Target) {

                console.log(
                    "ELLIE -> hidden footp4"
                );

                await Promise.all([

                    playVoice(5),

                    moveEllieTo(
                        scene2Footp4Target,
                        ELLIE_WALK_SPEED
                    )

                ]);
            }
            else if (riverTarget) {

                // Backup if footp4 somehow failed export.

                await Promise.all([

                    playVoice(5),

                    moveEllieTo(
                        riverTarget,
                        ELLIE_WALK_SPEED
                    )

                ]);
            }
            else {

                await playVoice(5);
            }

            stopWalk();

            // ========================================================
            // 7. VOICE 6
            // ========================================================

            await playVoice(6);

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE READY"
            );
        }

        // ============================================================
        // SCENE 3 BRIDGE
        // ============================================================

        async function buildBridgeLog() {

            if (
                sequenceRunning ||
                bridgeLogIndex >= 3
            ) {

                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            const sourceLog =
                sourceLogs[
                    bridgeLogIndex
                ];

            const finishedBridgeLog =
                bridgeLogs[
                    bridgeLogIndex
                ];

            console.log(
                "BUILD LOG",
                bridgeLogIndex + 1
            );

            // ========================================================
            // 1. ELLIE -> BRIDGE START
            // ========================================================

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // 2. ELLIE -> LOG PILE
            // ========================================================

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // 3. ELLIE + ONE SOURCE LOG -> BRIDGE
            // ========================================================

            let logPromise =
                Promise.resolve();

            if (
                sourceLog &&
                bridgePlaceTarget &&
                sourceLog.isMesh
            ) {

                logPromise =
                    safeLogAction(

                        animateObjectToTarget(
                            sourceLog,
                            bridgePlaceTarget,
                            BRIDGE_LOG_MOVE_DURATION
                        ),

                        2500
                    );
            }

            let elliePromise =
                Promise.resolve();

            if (bridgePlaceTarget) {

                elliePromise =
                    moveEllieTo(
                        bridgePlaceTarget,
                        ELLIE_WALK_SPEED
                    );
            }

            await Promise.all([
                logPromise,
                elliePromise
            ]);

            // ========================================================
            // 4. REPLACE MOVING LOG WITH BRIDGE LOG
            // ========================================================

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            if (finishedBridgeLog) {

                finishedBridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // FINISHED ALL THREE
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                storyStage =
                    "ENDING";

                interactionLocked =
                    true;

                await wait(1000);

                scene4Model.visible =
                    true;

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget,
                        ELLIE_WALK_SPEED
                    );
                }

                stopWalk();

                await playVoice(7);

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                sequenceRunning =
                    false;

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // ========================================================
            // 5. RETURN FOR NEXT LOG
            // ========================================================

            if (returnTarget) {

                await moveEllieTo(
                    returnTarget,
                    ELLIE_WALK_SPEED
                );
            }
            else if (
                bridgeStartTarget
            ) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            stopWalk();

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // TAP HANDLER
        // ============================================================

        function handleStoryTap() {

            if (
                !storyPlaced ||
                interactionLocked ||
                sequenceRunning
            ) {

                return;
            }

            const now =
                performance.now();

            if (
                now - lastTapTime <
                TAP_DEBOUNCE_MS
            ) {

                return;
            }

            lastTapTime =
                now;

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runScene1();

                return;
            }

            if (
                storyStage ===
                "LOG"
            ) {

                runScene2();

                return;
            }

            if (
                storyStage ===
                "BRIDGE"
            ) {

                buildBridgeLog();

                return;
            }
        }

        // ============================================================
        // RETICLE
        // ============================================================

        const ringGeometry =
            new THREE.RingGeometry(
                0.08,
                0.1,
                32
            );

        ringGeometry.rotateX(
            -Math.PI / 2
        );

        reticle =
            new THREE.Mesh(
                ringGeometry,
                new THREE.MeshBasicMaterial({
                    color:
                        0xffffff
                })
            );

        reticle.matrixAutoUpdate =
            false;

        reticle.visible =
            false;

        scene.add(
            reticle
        );

        // ============================================================
        // XR CONTROLLER
        // ============================================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {

                if (!storyPlaced) {

                    if (
                        !reticle.visible ||
                        !scenesReady
                    ) {

                        return;
                    }

                    const placement =
                        new THREE.Vector3();

                    placement.setFromMatrixPosition(
                        reticle.matrix
                    );

                    storyRoot.position.copy(
                        placement
                    );

                    storyRoot.rotation.set(
                        0,
                        0,
                        0
                    );

                    scene1Model.visible =
                        true;

                    scene2Model.visible =
                        false;

                    scene3Model.visible =
                        false;

                    scene4Model.visible =
                        false;

                    if (
                        scene2Footp4Target
                    ) {

                        scene2Footp4Target.visible =
                            false;
                    }

                    sourceLogs.forEach(
                        (log) => {

                            log.visible =
                                true;
                        }
                    );

                    bridgeLogs.forEach(
                        (log) => {

                            log.visible =
                                false;
                        }
                    );

                    bridgeLogIndex =
                        0;

                    storyRoot.visible =
                        true;

                    storyPlaced =
                        true;

                    reticle.visible =
                        false;

                    runIntro();

                    return;
                }

                handleStoryTap();
            }
        );

        scene.add(
            controller
        );

        // ============================================================
        // PHONE TAP FALLBACK
        // ============================================================

        function handleTouchEnd() {

            if (storyPlaced) {

                handleStoryTap();
            }
        }

        function handlePointerUp() {

            if (storyPlaced) {

                handleStoryTap();
            }
        }

        window.addEventListener(
            "touchend",
            handleTouchEnd,
            {
                passive:
                    true
            }
        );

        window.addEventListener(
            "pointerup",
            handlePointerUp
        );

        // ============================================================
        // XR LOOP
        // ============================================================

        function render(
            timestamp,
            frame
        ) {

            const delta =
                Math.min(
                    clock.getDelta(),
                    0.05
                );

            if (ellieMixer) {

                ellieMixer.update(
                    delta
                );
            }

            // Ellie movement.
            updateEllieMovement(
                delta
            );

            // Log / bridge movement.
            updateObjectMovement(
                delta
            );

            if (frame) {

                const referenceSpace =
                    renderer.xr
                        .getReferenceSpace();

                const session =
                    renderer.xr
                        .getSession();

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

                            storyStage =
                                "WAITING";

                            interactionLocked =
                                true;

                            sequenceRunning =
                                false;

                            ellieMovement =
                                null;

                            objectMovement =
                                null;

                            stopWalk();

                            if (
                                storyRoot
                            ) {

                                storyRoot.visible =
                                    false;
                            }

                            if (
                                currentAudio
                            ) {

                                currentAudio.pause();
                            }
                        }
                    );

                    hitTestSourceRequested =
                        true;
                }

                // ====================================================
                // FLOOR HIT TEST
                // ====================================================

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

                        const pose =
                            results[0]
                                .getPose(
                                    referenceSpace
                                );

                        if (pose) {

                            reticle.visible =
                                true;

                            reticle.matrix
                                .fromArray(
                                    pose.transform
                                        .matrix
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

        // ============================================================
        // RESIZE
        // ============================================================

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

        // ============================================================
        // CLEANUP
        // ============================================================

        return () => {

            window.removeEventListener(
                "resize",
                onResize
            );

            window.removeEventListener(
                "touchend",
                handleTouchEnd
            );

            window.removeEventListener(
                "pointerup",
                handlePointerUp
            );

            renderer.setAnimationLoop(
                null
            );

            if (
                currentAudio
            ) {

                currentAudio.pause();
            }

            if (
                renderer.domElement &&
                renderer.domElement.parentNode
            ) {

                renderer.domElement
                    .parentNode
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
                width:
                    "100vw",
                height:
                    "100vh",
                overflow:
                    "hidden",
                background:
                    "black"
            }}
        />
    );
}