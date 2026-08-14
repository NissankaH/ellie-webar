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

        // Slow, gentle walking pace.
        const ELLIE_WALK_SPEED = 0.008;

        // Log movement should be visible but not painfully slow.
        const LOG_MOVE_SPEED = 0.05;

        // Correct orientation so Ellie walks FORWARD.
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
        // STORY ROOT
        // ============================================================

        let storyRoot = null;

        // ============================================================
        // STORY SCENES
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

        // Ellie movement is updated inside XR render loop.
        let ellieMovement = null;

        // ============================================================
        // GENERIC OBJECT MOVEMENT
        // ============================================================

        // Used for:
        // big log lifting
        // big log moving aside
        // bridge source logs
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

        storyRoot.visible =
            false;

        scene.add(
            storyRoot
        );

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

            const search =
                normalizeName(
                    searchText
                );

            let result = null;

            root.traverse(
                (child) => {

                    if (result) {
                        return;
                    }

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name.includes(
                            search
                        )
                    ) {

                        result =
                            child;
                    }
                }
            );

            return result;
        }

        // ============================================================
        // FIND FINAL FOOTPRINT
        //
        // Handles:
        // footp__4__1
        // footp_4_1
        // footp.4.1
        //
        // They all normalize to footp41.
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

                    const name =
                        normalizeName(
                            child.name
                        );

                    if (
                        name ===
                        "footp41"
                    ) {

                        result =
                            child;
                    }
                }
            );

            return result;
        }

        // ============================================================
        // GET WORLD POSITION
        // ============================================================

        function getObjectWorldPosition(
            object
        ) {

            if (!object) {
                return null;
            }

            // For meshes, use actual visible center.
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

            // For target empties, use transform.
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

                logLiftObject =
                    findObjectContaining(
                        scene2Model,
                        "Log_Lift"
                    );

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
                    "LOG:",
                    logLiftObject?.name
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

                // ----------------------------------------------------
                // SOURCE LOGS
                // ----------------------------------------------------

                const sourceParent =
                    findObjectContaining(
                        scene3Model,
                        "SourceLogs"
                    );

                if (sourceParent) {

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
                                name === "log" ||
                                name === "log1" ||
                                name === "log2"
                            ) {

                                sourceLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                // ----------------------------------------------------
                // BRIDGE FINISHED LOGS
                // ----------------------------------------------------

                const bridgeParent =
                    findObjectContaining(
                        scene3Model,
                        "BridgeLogs"
                    );

                if (bridgeParent) {

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
                                name === "log3" ||
                                name === "log4" ||
                                name === "log5"
                            ) {

                                bridgeLogs.push(
                                    child
                                );

                                child.visible =
                                    false;
                            }
                        }
                    );
                }

                // ----------------------------------------------------
                // TARGETS
                // ----------------------------------------------------

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
                    "SOURCE LOGS:",
                    sourceLogs.length
                );

                console.log(
                    "BRIDGE LOGS:",
                    bridgeLogs.length
                );

                console.log(
                    "BRIDGE START:",
                    bridgeStartTarget?.name
                );

                console.log(
                    "LOG PILE:",
                    logPileTarget?.name
                );

                console.log(
                    "BRIDGE PLACE:",
                    bridgePlaceTarget?.name
                );

                console.log(
                    "RETURN TARGET:",
                    returnTarget?.name
                );

                console.log(
                    "RIVER TARGET:",
                    riverTarget?.name
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
                    "ENVIRONMENT LOAD ERROR:",
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
                    "ELLIE LOAD ERROR:",
                    error
                );
            }
        }

        loadEnvironment();
        loadEllie();

        // ============================================================
        // AUDIO
        // ============================================================

        function playVoice(
            number
        ) {

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
        // WALK ANIMATION
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
        // START ELLIE MOVEMENT
        //
        // Actual movement happens inside render().
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

                    // Stay at ground height.
                    destination.y =
                        ellieModel.position.y;

                    const distance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "ELLIE MOVE DISTANCE:",
                        distance
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

            const world =
                getObjectWorldPosition(
                    target
                );

            return moveEllieToWorldPosition(
                world,
                speed
            );
        }

        // ============================================================
        // UPDATE ELLIE MOVEMENT
        // ============================================================

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

            direction.y =
                0;

            const distance =
                direction.length();

            // --------------------------------------------------------
            // ARRIVED
            // --------------------------------------------------------

            if (
                distance <=
                0.002
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

            // --------------------------------------------------------
            // FACE MOVEMENT DIRECTION
            // --------------------------------------------------------

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

            // --------------------------------------------------------
            // MOVE SLOWLY
            // --------------------------------------------------------

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
        // START OBJECT MOVEMENT
        //
        // Used for ALL LOG MOVEMENT.
        // ============================================================

        function moveObjectToWorldPosition(
            object,
            worldPosition,
            speed = LOG_MOVE_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        !object ||
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

            if (
                !object ||
                !target
            ) {

                console.warn(
                    "OBJECT MOVEMENT TARGET MISSING"
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

        // ============================================================
        // UPDATE OBJECT MOVEMENT
        //
        // XR-safe log movement.
        // ============================================================

        function updateObjectMovement(
            delta
        ) {

            if (!objectMovement) {
                return;
            }

            const object =
                objectMovement.object;

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
                distance <=
                0.002
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
                "INTRO DONE - TAP ANYWHERE"
            );
        }

        // ============================================================
        // SCENE 1 - FOOTPRINT FLOW
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

            console.log(
                "FOOTPRINT FLOW START"
            );

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

            // Voice 2 + Ellie walk together.
            await Promise.all([

                playVoice(2),

                moveEllieToWorldPosition(
                    finalPosition,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

            console.log(
                "SCENE 2 VISIBLE"
            );

            // Voice 3 tells child about log.
            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "LOG STAGE READY - TAP ANYWHERE"
            );
        }

        // ============================================================
        // SCENE 2 - LOG FLOW
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
                "LOG SEQUENCE START"
            );

            // ========================================================
            // VOICE 4 STARTS
            // ========================================================

            const voice4 =
                playVoice(4);

            // ========================================================
            // ELLIE WALKS TO LOG TARGET
            // ========================================================

            if (elephantLogTarget) {

                await moveEllieTo(
                    elephantLogTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // Small pause.
            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        300
                    )
            );

            // ========================================================
            // LIFT LOG
            // ========================================================

            console.log(
                "LIFTING LOG"
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

            // Hold it in air briefly.
            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        500
                    )
            );

            // ========================================================
            // MOVE LOG TO SIDE / CORNER
            // ========================================================

            console.log(
                "MOVING LOG TO SIDE"
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
            // SCENE 3 APPEARS NOW
            // ========================================================

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 VISIBLE"
            );

            // Let Voice 4 finish if still speaking.
            await voice4;

            // ========================================================
            // VOICE 5 + WALK TO RIVER
            // ========================================================

            storyStage =
                "WALK_TO_RIVER";

            await Promise.all([

                playVoice(5),

                moveEllieTo(
                    riverTarget,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // ========================================================
            // VOICE 6
            // ========================================================

            storyStage =
                "BRIDGE_INSTRUCTION";

            await playVoice(6);

            // ========================================================
            // BRIDGE READY
            // ========================================================

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE READY - TAP 3 TIMES"
            );
        }

        // ============================================================
        // SCENE 3 - BUILD ONE BRIDGE LOG
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

            const finishedBridgeLog =
                bridgeLogs[
                    bridgeLogIndex
                ];

            console.log(
                "BUILDING BRIDGE LOG:",
                bridgeLogIndex + 1
            );

            // ========================================================
            // STEP 1
            // ELLIE MOVES TO BRIDGE START
            // ========================================================

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // STEP 2
            // ELLIE WALKS TO LOG PILE
            // ========================================================

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // ========================================================
            // STEP 3
            // ELLIE + SOURCE LOG MOVE TO BRIDGE
            // ========================================================

            let logMovePromise =
                Promise.resolve();

            if (
                sourceLog &&
                bridgePlaceTarget
            ) {

                const bridgeWorld =
                    getObjectWorldPosition(
                        bridgePlaceTarget
                    );

                logMovePromise =
                    moveObjectToWorldPosition(
                        sourceLog,
                        bridgeWorld,
                        LOG_MOVE_SPEED
                    );
            }

            let ellieMovePromise =
                Promise.resolve();

            if (bridgePlaceTarget) {

                ellieMovePromise =
                    moveEllieTo(
                        bridgePlaceTarget,
                        ELLIE_WALK_SPEED
                    );
            }

            // Elephant and log travel together.
            await Promise.all([
                logMovePromise,
                ellieMovePromise
            ]);

            // ========================================================
            // STEP 4
            // SNAP LOG INTO FINISHED BRIDGE
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

            console.log(
                "BRIDGE LOG PLACED:",
                bridgeLogIndex
            );

            // ========================================================
            // ALL 3 LOGS FINISHED
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                interactionLocked =
                    true;

                storyStage =
                    "ENDING";

                console.log(
                    "BRIDGE COMPLETE"
                );

                // Required 1 second delay.
                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                // ====================================================
                // SHOW FINAL SCENE
                // ====================================================

                scene4Model.visible =
                    true;

                console.log(
                    "SCENE 4 VISIBLE"
                );

                // ====================================================
                // WALK TO MOMMY / FINAL POINT
                // ====================================================

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget,
                        ELLIE_WALK_SPEED
                    );
                }

                stopWalk();

                // ====================================================
                // VOICE 7 - REUNION
                // ====================================================

                await playVoice(7);

                // ====================================================
                // VOICE 8 - ENDING
                // ====================================================

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

            // ========================================================
            // RETURN FOR NEXT LOG
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

            console.log(
                "READY FOR NEXT BRIDGE TAP"
            );
        }

        // ============================================================
        // STORY TAP
        //
        // Child-friendly:
        // tap ANYWHERE after each instruction.
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

            console.log(
                "STORY TAP:",
                storyStage
            );

            // ========================================================
            // SCENE 1
            // ========================================================

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runFootprints();

                return;
            }

            // ========================================================
            // SCENE 2
            // ========================================================

            if (
                storyStage ===
                "LOG"
            ) {

                runLogSequence();

                return;
            }

            // ========================================================
            // SCENE 3
            // ========================================================

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

                // ====================================================
                // FIRST TAP = PLACE STORY
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

                    // ------------------------------------------------
                    // RESET SCENES
                    // ------------------------------------------------

                    scene1Model.visible =
                        true;

                    scene2Model.visible =
                        false;

                    scene3Model.visible =
                        false;

                    scene4Model.visible =
                        false;

                    // ------------------------------------------------
                    // RESET BRIDGE
                    // ------------------------------------------------

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

                    // ------------------------------------------------
                    // SHOW STORY
                    // ------------------------------------------------

                    storyRoot.visible =
                        true;

                    storyPlaced =
                        true;

                    reticle.visible =
                        false;

                    console.log(
                        "STORY PLACED"
                    );

                    // Voice 1.
                    runIntro();

                    return;
                }

                // Normal progression tap.
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

            // ========================================================
            // ELLIE ANIMATION
            // ========================================================

            if (ellieMixer) {

                ellieMixer.update(
                    delta
                );
            }

            // ========================================================
            // ELLIE TRANSLATION
            // ========================================================

            updateEllieMovement(
                delta
            );

            // ========================================================
            // LOG / OBJECT TRANSLATION
            // ========================================================

            updateObjectMovement(
                delta
            );

            // ========================================================
            // WEBXR
            // ========================================================

            if (frame) {

                const referenceSpace =
                    renderer.xr
                        .getReferenceSpace();

                const session =
                    renderer.xr
                        .getSession();

                // ====================================================
                // HIT TEST SETUP
                // ====================================================

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