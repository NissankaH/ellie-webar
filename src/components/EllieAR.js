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

        const WORLD_SCALE = 2.5;

        // Very gentle walking speed.
        const ELLIE_WALK_SPEED = 0.008;

        // Log movement.
        const LOG_MOVE_SPEED = 0.05;

        // Correct direction for Ellie model.
        const ELLIE_ROTATION_OFFSET = -90;

        const TAP_DEBOUNCE_MS = 350;

        // ============================================================
        // THREE / WEBXR
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
        // STORY ROOT + SCENES
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
        // GENERIC MOVING OBJECT
        // ============================================================

        let objectMovement = null;

        // ============================================================
        // SCENE 1
        // ============================================================

        let finalFootprintTarget = null;

        // ============================================================
        // SCENE 2
        // ============================================================

        let logLiftObject = null;

        let elephantLogTarget = null;
        let logLiftTarget = null;
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
        // STORY STATE
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
        // THREE SCENE
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

        storyRoot.visible = false;

        scene.add(storyRoot);

        // ============================================================
        // GLTF LOADER
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

            return name
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );
        }

        function findObjectContaining(
            root,
            searchText
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    searchText
                );

            let result = null;

            root.traverse(
                (child) => {

                    // NEVER return root itself.
                    if (child === root) {
                        return;
                    }

                    if (result) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name.includes(wanted)
                    ) {

                        result = child;
                    }
                }
            );

            return result;
        }

        // ============================================================
        // SAFE LOG LOOKUP
        //
        // IMPORTANT:
        // Never returns Scene2Model itself.
        // ============================================================

        function findSafeLogLiftObject(
            root
        ) {

            if (!root) {
                return null;
            }

            const wanted = "loglift";

            let exactMesh = null;

            // --------------------------------------------------------
            // FIRST:
            // Find actual mesh named Log_Lift.
            // --------------------------------------------------------

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        !child.isMesh
                    ) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name === wanted
                    ) {

                        exactMesh = child;
                    }
                }
            );

            if (exactMesh) {

                console.log(
                    "FOUND LOG MESH:",
                    exactMesh.name
                );

                return exactMesh;
            }

            // --------------------------------------------------------
            // SECOND:
            // Find non-root object exactly called Log_Lift.
            //
            // This may be a group containing ONLY the log pieces.
            // --------------------------------------------------------

            let exactNode = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        exactNode
                    ) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name === wanted
                    ) {

                        exactNode = child;
                    }
                }
            );

            if (exactNode) {

                console.log(
                    "FOUND LOG NODE:",
                    exactNode.name
                );

                return exactNode;
            }

            // --------------------------------------------------------
            // THIRD FALLBACK:
            // Find a MESH containing loglift.
            //
            // We ONLY accept meshes here.
            // --------------------------------------------------------

            let fallbackMesh = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        !child.isMesh ||
                        fallbackMesh
                    ) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name.includes(
                            wanted
                        ) &&
                        !name.includes(
                            "target"
                        )
                    ) {

                        fallbackMesh =
                            child;
                    }
                }
            );

            if (fallbackMesh) {

                console.log(
                    "FOUND LOG FALLBACK MESH:",
                    fallbackMesh.name
                );
            }

            return fallbackMesh;
        }

        // ============================================================
        // FINAL FOOTPRINT
        // ============================================================

        function findFinalFootprint(
            root
        ) {

            if (!root) {
                return null;
            }

            let result = null;

            root.traverse(
                (child) => {

                    if (child === root) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    // footp__4__1
                    // footp_4_1
                    // footp.4.1
                    // -> footp41

                    if (
                        name === "footp41"
                    ) {

                        result = child;
                    }
                }
            );

            return result;
        }

        // ============================================================
        // WORLD POSITION
        // ============================================================

        function getObjectWorldPosition(
            object
        ) {

            if (!object) {
                return null;
            }

            // Mesh:
            // use visual center.
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

            // Empty / target:
            // use object transform.
            const world =
                new THREE.Vector3();

            object.getWorldPosition(
                world
            );

            return world;
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

                finalFootprintTarget =
                    findFinalFootprint(
                        scene1Model
                    );

                console.log(
                    "FINAL FOOTPRINT:",
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

                // ----------------------------------------------------
                // SAFE LOG LOOKUP
                // ----------------------------------------------------

                logLiftObject =
                    findSafeLogLiftObject(
                        scene2Model
                    );

                // Absolute safety.
                if (
                    logLiftObject === scene2Model ||
                    logLiftObject === storyRoot
                ) {

                    console.error(
                        "UNSAFE LOG OBJECT DETECTED!"
                    );

                    logLiftObject = null;
                }

                elephantLogTarget =
                    findObjectContaining(
                        scene2Model,
                        "elephantlogTarget"
                    );

                logLiftTarget =
                    findObjectContaining(
                        scene2Model,
                        "logLiftTarget"
                    );

                logSideTarget =
                    findObjectContaining(
                        scene2Model,
                        "logSideTarget"
                    );

                console.log(
                    "SAFE LOG OBJECT:",
                    logLiftObject?.name
                );

                console.log(
                    "LOG PARENT:",
                    logLiftObject?.parent?.name
                );

                console.log(
                    "ELEPHANT LOG TARGET:",
                    elephantLogTarget?.name
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

                const sourceParent =
                    findObjectContaining(
                        scene3Model,
                        "SourceLogs"
                    );

                const sourceMap = {
                    log: null,
                    log1: null,
                    log2: null
                };

                if (sourceParent) {

                    sourceParent.traverse(
                        (child) => {

                            // CRITICAL:
                            // ONLY individual meshes.
                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        sourceMap,
                                        name
                                    )
                            ) {

                                sourceMap[name] =
                                    child;
                            }
                        }
                    );
                }

                sourceLogs = [
                    sourceMap.log,
                    sourceMap.log1,
                    sourceMap.log2
                ].filter(Boolean);

                // ====================================================
                // FINISHED BRIDGE LOGS
                // ====================================================

                const bridgeParent =
                    findObjectContaining(
                        scene3Model,
                        "BridgeLogs"
                    );

                const bridgeMap = {
                    log3: null,
                    log4: null,
                    log5: null
                };

                if (bridgeParent) {

                    bridgeParent.traverse(
                        (child) => {

                            // Again:
                            // ONLY individual meshes.
                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        bridgeMap,
                                        name
                                    )
                            ) {

                                bridgeMap[name] =
                                    child;
                            }
                        }
                    );
                }

                bridgeLogs = [
                    bridgeMap.log3,
                    bridgeMap.log4,
                    bridgeMap.log5
                ].filter(Boolean);

                bridgeLogs.forEach(
                    (log) => {

                        log.visible =
                            false;
                    }
                );

                // ====================================================
                // TARGETS
                // ====================================================

                bridgeStartTarget =
                    findObjectContaining(
                        scene3Model,
                        "BridgeStartTarget"
                    );

                bridgePlaceTarget =
                    findObjectContaining(
                        scene3Model,
                        "BridgePlaceTarget"
                    );

                logPileTarget =
                    findObjectContaining(
                        scene3Model,
                        "LogPileTarget"
                    );

                riverTarget =
                    findObjectContaining(
                        scene3Model,
                        "RiverTarget"
                    );

                returnTarget =
                    findObjectContaining(
                        scene3Model,
                        "ReturnTarget"
                    );

                console.log(
                    "SAFE SOURCE LOGS:",
                    sourceLogs.map(
                        (log) =>
                            log.name
                    )
                );

                console.log(
                    "SAFE BRIDGE LOGS:",
                    bridgeLogs.map(
                        (log) =>
                            log.name
                    )
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
                    findObjectContaining(
                        scene4Model,
                        "FinalTarget"
                    );

                if (!finalTarget) {

                    finalTarget =
                        findObjectContaining(
                            scene4Model,
                            "EndTarget"
                        );
                }

                if (!finalTarget) {

                    finalTarget =
                        findObjectContaining(
                            scene4Model,
                            "MommyTarget"
                        );
                }

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
                            (error) => {

                                console.error(
                                    "VOICE ERROR:",
                                    error
                                );

                                resolve();
                            }
                        );
                }
            );
        }

        // ============================================================
        // ELLIE WALK ANIMATION
        // ============================================================

        function startWalk() {

            if (!ellieWalkAction) {
                return;
            }

            ellieWalkAction.paused =
                false;
        }

        function stopWalk() {

            if (!ellieWalkAction) {
                return;
            }

            ellieWalkAction.paused =
                true;
        }

        // ============================================================
        // ELLIE MOVEMENT
        // ============================================================

        function moveEllieToWorldPosition(
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

            const world =
                getObjectWorldPosition(
                    target
                );

            return moveEllieToWorldPosition(
                world,
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

            const destination =
                ellieMovement.destination;

            const direction =
                destination
                    .clone()
                    .sub(
                        ellieModel.position
                    );

            direction.y = 0;

            const distance =
                direction.length();

            if (
                distance <= 0.002
            ) {

                ellieModel.position.x =
                    destination.x;

                ellieModel.position.z =
                    destination.z;

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
        // SAFE OBJECT MOVEMENT
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

        function moveObjectToWorldPosition(
            object,
            worldPosition,
            speed = LOG_MOVE_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    // =================================================
                    // CRITICAL PROTECTION
                    // =================================================

                    if (
                        isUnsafeMovementObject(
                            object
                        )
                    ) {

                        console.error(
                            "BLOCKED UNSAFE OBJECT MOVEMENT:",
                            object?.name
                        );

                        resolve();

                        return;
                    }

                    if (!worldPosition) {

                        resolve();

                        return;
                    }

                    const parent =
                        object.parent;

                    if (!parent) {

                        resolve();

                        return;
                    }

                    const destination =
                        parent.worldToLocal(
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

            if (
                isUnsafeMovementObject(
                    object
                )
            ) {

                console.error(
                    "REFUSED TO MOVE SCENE ROOT"
                );

                return Promise.resolve();
            }

            if (!target) {

                console.warn(
                    "OBJECT TARGET MISSING"
                );

                return Promise.resolve();
            }

            const world =
                getObjectWorldPosition(
                    target
                );

            return moveObjectToWorldPosition(
                object,
                world,
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

            // Safety check EVERY frame too.
            if (
                isUnsafeMovementObject(
                    object
                )
            ) {

                console.error(
                    "STOPPED UNSAFE MOVEMENT"
                );

                const finish =
                    objectMovement.resolve;

                objectMovement =
                    null;

                finish();

                return;
            }

            const destination =
                objectMovement.destination;

            const direction =
                destination
                    .clone()
                    .sub(
                        object.position
                    );

            const distance =
                direction.length();

            if (
                distance <= 0.002
            ) {

                object.position.copy(
                    destination
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

            storyStage =
                "INTRO";

            interactionLocked =
                true;

            sequenceRunning =
                true;

            await playVoice(1);

            storyStage =
                "FOOTPRINTS";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "INTRO DONE"
            );
        }

        // ============================================================
        // SCENE 1
        // ============================================================

        async function runFootprints() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "FOOTPRINT_WALK";

            if (!finalFootprintTarget) {

                finalFootprintTarget =
                    findFinalFootprint(
                        scene1Model
                    );
            }

            const finalPosition =
                getObjectWorldPosition(
                    finalFootprintTarget
                );

            await Promise.all([

                playVoice(2),

                moveEllieToWorldPosition(
                    finalPosition,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            scene2Model.visible =
                true;

            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "LOG STAGE READY"
            );
        }

        // ============================================================
        // SCENE 2 - BIG LOG
        // ============================================================

        async function runLogSequence() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "LOG_SEQUENCE";

            console.log(
                "STARTING LOG SEQUENCE"
            );

            console.log(
                "MOVING OBJECT:",
                logLiftObject?.name
            );

            // Absolute safety check.
            if (
                isUnsafeMovementObject(
                    logLiftObject
                )
            ) {

                console.error(
                    "LOG OBJECT IS UNSAFE. LOG MOVE CANCELLED."
                );

                sequenceRunning =
                    false;

                interactionLocked =
                    false;

                storyStage =
                    "LOG";

                return;
            }

            const voice4 =
                playVoice(4);

            // --------------------------------------------------------
            // Ellie slowly walks to log.
            // --------------------------------------------------------

            if (elephantLogTarget) {

                await moveEllieTo(
                    elephantLogTarget,
                    ELLIE_WALK_SPEED
                );
            }

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        300
                    )
            );

            // --------------------------------------------------------
            // ONLY LOG MOVES UP.
            // --------------------------------------------------------

            console.log(
                "LIFTING ONLY:",
                logLiftObject?.name
            );

            if (
                logLiftObject &&
                logLiftTarget
            ) {

                await moveObjectToTarget(
                    logLiftObject,
                    logLiftTarget,
                    LOG_MOVE_SPEED
                );
            }

            // Hold in air.
            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        500
                    )
            );

            // --------------------------------------------------------
            // ONLY LOG MOVES TO SIDE.
            // --------------------------------------------------------

            console.log(
                "MOVING ONLY LOG TO CORNER"
            );

            if (
                logLiftObject &&
                logSideTarget
            ) {

                await moveObjectToTarget(
                    logLiftObject,
                    logSideTarget,
                    LOG_MOVE_SPEED
                );
            }

            console.log(
                "LOG CLEARED"
            );

            // ========================================================
            // SCENE 3
            // ========================================================

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 VISIBLE"
            );

            await voice4;

            // --------------------------------------------------------
            // Voice 5 + walk to river.
            // --------------------------------------------------------

            await Promise.all([

                playVoice(5),

                moveEllieTo(
                    riverTarget,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // --------------------------------------------------------
            // Bridge instructions.
            // --------------------------------------------------------

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
        // SCENE 3 - BRIDGE
        // ============================================================

        async function buildNextBridgeLog() {

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

            const finishedLog =
                bridgeLogs[
                    bridgeLogIndex
                ];

            console.log(
                "SOURCE LOG:",
                sourceLog?.name
            );

            // ========================================================
            // SAFETY
            //
            // Must be an individual mesh.
            // ========================================================

            if (
                sourceLog &&
                !sourceLog.isMesh
            ) {

                console.error(
                    "BRIDGE SOURCE IS NOT A MESH!"
                );

                sequenceRunning =
                    false;

                interactionLocked =
                    false;

                return;
            }

            // --------------------------------------------------------
            // Go to bridge start.
            // --------------------------------------------------------

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // --------------------------------------------------------
            // Walk to log pile.
            // --------------------------------------------------------

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // --------------------------------------------------------
            // Move ONLY ONE source log toward bridge.
            // --------------------------------------------------------

            let sourceMove =
                Promise.resolve();

            if (
                sourceLog &&
                bridgePlaceTarget
            ) {

                const bridgePosition =
                    getObjectWorldPosition(
                        bridgePlaceTarget
                    );

                sourceMove =
                    moveObjectToWorldPosition(
                        sourceLog,
                        bridgePosition,
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

            // Ellie and ONE log move together.
            await Promise.all([
                sourceMove,
                ellieMove
            ]);

            // --------------------------------------------------------
            // Hide travelling source log.
            // Show pre-positioned bridge log.
            // --------------------------------------------------------

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            if (finishedLog) {

                finishedLog.visible =
                    true;
            }

            bridgeLogIndex++;

            console.log(
                "BRIDGE LOG COMPLETE:",
                bridgeLogIndex
            );

            // ========================================================
            // BRIDGE FINISHED
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

                interactionLocked =
                    true;

                sequenceRunning =
                    false;

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // --------------------------------------------------------
            // Return for another log.
            // --------------------------------------------------------

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

            console.log(
                "READY FOR NEXT LOG"
            );
        }

        // ============================================================
        // STORY TAP
        // ============================================================

        function handleStoryTap() {

            if (!storyPlaced) {
                return;
            }

            if (
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

                runFootprints();

                return;
            }

            if (
                storyStage ===
                "LOG"
            ) {

                runLogSequence();

                return;
            }

            if (
                storyStage ===
                "BRIDGE"
            ) {

                buildNextBridgeLog();

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
                    color: 0xffffff
                })
            );

        reticle.matrixAutoUpdate =
            false;

        reticle.visible =
            false;

        scene.add(reticle);

        // ============================================================
        // XR CONTROLLER
        // ============================================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {

                // ====================================================
                // INITIAL PLACEMENT
                // ====================================================

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

        scene.add(controller);

        // ============================================================
        // PHONE TAP FALLBACK
        // ============================================================

        function handleTouchEnd() {

            if (!storyPlaced) {
                return;
            }

            handleStoryTap();
        }

        function handlePointerUp() {

            if (!storyPlaced) {
                return;
            }

            handleStoryTap();
        }

        window.addEventListener(
            "touchend",
            handleTouchEnd,
            {
                passive: true
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

            // Ellie skeletal animation.
            if (ellieMixer) {

                ellieMixer.update(
                    delta
                );
            }

            // Ellie physical movement.
            updateEllieMovement(
                delta
            );

            // Big log / bridge log physical movement.
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
                // FLOOR DETECTION
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
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                background: "black"
            }}
        />
    );
}