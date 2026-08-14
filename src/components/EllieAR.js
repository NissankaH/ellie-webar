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

        // Very slow walking.
        const ELLIE_WALK_SPEED = 0.008;

        // Log moves faster than Ellie but still visibly.
        const LOG_MOVE_SPEED = 0.04;

        // How high the log rises before moving aside.
        const LOG_LIFT_HEIGHT = 0.08;

        // Delay before Scene 3 appears.
        const SCENE3_DELAY = 2000;

        // Ellie orientation.
        const ELLIE_ROTATION_OFFSET = -90;

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
        // ROOT + SCENES
        // ============================================================

        let storyRoot = null;

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
        // GENERIC OBJECT MOVEMENT
        // ============================================================

        let objectMovement = null;

        // ============================================================
        // SCENE 1
        // ============================================================

        let finalFootprintTarget = null;

        // ============================================================
        // SCENE 2
        // ============================================================

        // Hidden footp4 target.
        // Ellie goes here AFTER log sequence / Scene 3.
        let scene2Footp4Target = null;

        // Actual log.
        let logLiftObject = null;

        // Ellie walks here when log interaction begins.
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
        // CREATE SCENE
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

        scene.add(hemisphereLight);

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

        scene.add(directionalLight);

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

        storyRoot.visible =
            false;

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

            let found =
                null;

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

            let found =
                null;

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
        // WORLD POSITION
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
        // SAFE OBJECT CHECK
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
                    "SCENE1 FINAL FOOTPRINT:",
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

                        if (
                            normalizeName(
                                child.name
                            ) === "footp4"
                        ) {

                            if (
                                !scene2Footp4Target
                            ) {

                                scene2Footp4Target =
                                    child;
                            }

                            // Never show it.
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
                // LOG LIFT TARGET
                //
                // IMPORTANT:
                // Ellie walks HERE.
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
                // LOG SIDE TARGET
                //
                // Actual log ends here.
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
                    "SCENE2 HIDDEN FOOTP4:",
                    scene2Footp4Target?.name
                );

                console.log(
                    "ACTUAL LOG:",
                    logLiftObject?.name
                );

                console.log(
                    "ELLIE LOG TARGET:",
                    logLiftTarget?.name
                );

                console.log(
                    "LOG CORNER TARGET:",
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

                    const validNames =
                        [
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
                // FINISHED BRIDGE LOGS
                // ====================================================

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

                    const validNames =
                        [
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
                // BRIDGE TARGETS
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

                ellieModel.rotation.set(
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
                        distance <
                        0.001
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

            direction.y = 0;

            const distance =
                direction.length();

            if (
                distance <=
                0.002
            ) {

                ellieModel.position.x =
                    ellieMovement
                        .destination.x;

                ellieModel.position.z =
                    ellieMovement
                        .destination.z;

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
        // OBJECT MOVEMENT
        // ============================================================

        function moveObjectToWorld(
            object,
            worldPosition,
            speed = LOG_MOVE_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        isUnsafeMovementObject(
                            object
                        ) ||
                        !worldPosition
                    ) {

                        resolve();
                        return;
                    }

                    const destination =
                        object.parent
                            .worldToLocal(
                                worldPosition.clone()
                            );

                    objectMovement = {

                        object:
                            object,

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

        function moveObjectToTarget(
            object,
            target,
            speed = LOG_MOVE_SPEED
        ) {

            if (!target) {

                return Promise.resolve();
            }

            return moveObjectToWorld(
                object,
                getWorldPosition(
                    target
                ),
                speed
            );
        }

        function updateObjectMovement(
            delta
        ) {

            if (!objectMovement) {
                return;
            }

            const object =
                objectMovement.object;

            if (
                isUnsafeMovementObject(
                    object
                )
            ) {

                const finish =
                    objectMovement.resolve;

                objectMovement =
                    null;

                finish();

                return;
            }

            const direction =
                objectMovement
                    .destination
                    .clone()
                    .sub(
                        object.position
                    );

            const distance =
                direction.length();

            if (
                distance <=
                0.002
            ) {

                object.position.copy(
                    objectMovement
                        .destination
                );

                const finish =
                    objectMovement.resolve;

                objectMovement =
                    null;

                finish();

                return;
            }

            const amount =
                Math.min(
                    objectMovement.speed *
                    delta,
                    distance
                );

            direction.normalize();

            object.position.addScaledVector(
                direction,
                amount
            );
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

            const endPosition =
                getMeshCenterWorld(
                    finalFootprintTarget
                );

            await Promise.all([

                playVoice(2),

                moveEllieToWorld(
                    endPosition,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

            // Hidden guide stays hidden.
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

            // Voice 4 begins.
            const voice4 =
                playVoice(4);

            // ========================================================
            // 1. ELLIE WALKS TO LOG LIFT TARGET
            // ========================================================

            if (logLiftTarget) {

                console.log(
                    "ELLIE WALKING TO LOG LIFT TARGET"
                );

                await moveEllieTo(
                    logLiftTarget,
                    ELLIE_WALK_SPEED
                );
            }

            stopWalk();

            // ========================================================
            // 2. ACTUAL LOG LIFTS UP
            // ========================================================

            if (logLiftObject) {

                const currentWorld =
                    getWorldPosition(
                        logLiftObject
                    );

                const liftedWorld =
                    currentWorld.clone();

                liftedWorld.y +=
                    LOG_LIFT_HEIGHT;

                console.log(
                    "LIFTING ACTUAL LOG"
                );

                await moveObjectToWorld(
                    logLiftObject,
                    liftedWorld,
                    LOG_MOVE_SPEED
                );
            }

            // Hold for a moment.
            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        500
                    )
            );

            // ========================================================
            // 3. LOG MOVES BY ITSELF TO CORNER
            // ========================================================

            if (
                logLiftObject &&
                logSideTarget
            ) {

                console.log(
                    "LOG MOVING TO SIDE TARGET"
                );

                await moveObjectToTarget(
                    logLiftObject,
                    logSideTarget,
                    LOG_MOVE_SPEED
                );
            }

            // Ellie stays at logLiftTarget.

            stopWalk();

            // Let Voice 4 finish.
            await voice4;

            // ========================================================
            // 4. WAIT BEFORE SCENE 3
            // ========================================================

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        SCENE3_DELAY
                    )
            );

            // ========================================================
            // 5. SCENE 3 APPEARS
            // ========================================================

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 VISIBLE"
            );

            // ========================================================
            // 6. ELLIE NOW WALKS TO HIDDEN FOOTP4
            //
            // NOT before log action.
            // ========================================================

            if (scene2Footp4Target) {

                console.log(
                    "ELLIE NOW WALKING TO HIDDEN FOOTP4"
                );

                await Promise.all([

                    playVoice(5),

                    moveEllieTo(
                        scene2Footp4Target,
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
        // BRIDGE
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

            const bridgeLog =
                bridgeLogs[
                    bridgeLogIndex
                ];

            // ========================================================
            // WALK TO BRIDGE START
            // ========================================================

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // WALK TO LOG PILE
            // ========================================================

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // MOVE SOURCE LOG + ELLIE TO BRIDGE
            // ========================================================

            let logMove =
                Promise.resolve();

            if (
                sourceLog &&
                bridgePlaceTarget
            ) {

                logMove =
                    moveObjectToTarget(
                        sourceLog,
                        bridgePlaceTarget,
                        LOG_MOVE_SPEED
                    );
            }

            let ellieMove =
                Promise.resolve();

            if (bridgePlaceTarget) {

                ellieMove =
                    moveEllieTo(
                        bridgePlaceTarget,
                        ELLIE_WALK_SPEED
                    );
            }

            await Promise.all([
                logMove,
                ellieMove
            ]);

            // ========================================================
            // REPLACE SOURCE WITH FINISHED BRIDGE LOG
            // ========================================================

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            if (bridgeLog) {

                bridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // ALL 3 DONE
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                interactionLocked =
                    true;

                storyStage =
                    "ENDING";

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

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

                return;
            }

            // ========================================================
            // RETURN
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
        // STORY TAP
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

                    if (scene2Footp4Target) {

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
        // XR RENDER LOOP
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

            // Ellie translation.
            updateEllieMovement(
                delta
            );

            // Log translation.
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

                            if (storyRoot) {

                                storyRoot.visible =
                                    false;
                            }

                            if (currentAudio) {

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

            if (currentAudio) {

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