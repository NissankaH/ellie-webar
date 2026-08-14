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

        // Slow walking.
        const ELLIE_WALK_SPEED = 0.035;

        const LOG_MOVE_SPEED = 0.08;

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
        // STORY
        // ============================================================

        let storyRoot;

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

        // ============================================================
        // SCENE 1
        // ============================================================

        let footprintMeshes = [];
        let lastFootprint = null;

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
        // STATE
        // ============================================================

        let scenesReady = false;
        let storyPlaced = false;

        let interactionLocked = true;

        let storyStage = "WAITING";

        let bridgeLogIndex = 0;

        let currentAudio = null;

        // Prevent duplicate async sequences.
        let sequenceRunning = false;

        // ============================================================
        // SCENE
        // ============================================================

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.01,
            100
        );

        // ============================================================
        // LIGHTS
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

        renderer.xr.enabled =
            true;

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
        // FIND OBJECT
        // ============================================================

        function findObjectContaining(
            root,
            searchText
        ) {

            if (!root) {
                return null;
            }

            const search =
                searchText
                    .toLowerCase();

            let result =
                null;

            root.traverse(
                (child) => {

                    if (result) {
                        return;
                    }

                    const name =
                        child.name
                            .toLowerCase();

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

                // ----------------------------------------------------
                // FOOTPRINTS
                // ----------------------------------------------------

                footprintMeshes =
                    [];

                scene1Model.traverse(
                    (child) => {

                        if (!child.isMesh) {
                            return;
                        }

                        const name =
                            child.name
                                .toLowerCase();

                        if (
                            name === "footp" ||
                            name.startsWith(
                                "footp_"
                            )
                        ) {

                            footprintMeshes.push(
                                child
                            );

                            console.log(
                                "FOOTPRINT:",
                                child.name
                            );
                        }
                    }
                );

                console.log(
                    "FOOTPRINT COUNT:",
                    footprintMeshes.length
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
                    scene2Model.getObjectByName(
                        "Log_Lift"
                    );

                if (!logLiftObject) {

                    logLiftObject =
                        findObjectContaining(
                            scene2Model,
                            "log_lift"
                        );
                }

                elephantLogTarget =
                    findObjectContaining(
                        scene2Model,
                        "elephantlog"
                    );

                logLiftTarget =
                    findObjectContaining(
                        scene2Model,
                        "loglifttarget"
                    );

                logSideTarget =
                    findObjectContaining(
                        scene2Model,
                        "logsidetarget"
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

                const sourceLogsParent =
                    findObjectContaining(
                        scene3Model,
                        "sourcelogs"
                    );

                if (sourceLogsParent) {

                    sourceLogsParent.traverse(
                        (child) => {

                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                child.name
                                    .toLowerCase();

                            if (
                                name === "log" ||
                                name === "log_1" ||
                                name === "log_2"
                            ) {

                                sourceLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                // ----------------------------------------------------
                // BRIDGE LOGS
                // ----------------------------------------------------

                const bridgeLogsParent =
                    findObjectContaining(
                        scene3Model,
                        "bridgelogs"
                    );

                if (bridgeLogsParent) {

                    bridgeLogsParent.traverse(
                        (child) => {

                            if (!child.isMesh) {
                                return;
                            }

                            const name =
                                child.name
                                    .toLowerCase();

                            if (
                                name === "log_3" ||
                                name === "log_4" ||
                                name === "log_5"
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

                bridgeStartTarget =
                    findObjectContaining(
                        scene3Model,
                        "bridgestarttarget"
                    );

                bridgePlaceTarget =
                    findObjectContaining(
                        scene3Model,
                        "bridgeplacetarget"
                    );

                logPileTarget =
                    findObjectContaining(
                        scene3Model,
                        "logpiletarget"
                    );

                riverTarget =
                    findObjectContaining(
                        scene3Model,
                        "rivertarget"
                    );

                returnTarget =
                    findObjectContaining(
                        scene3Model,
                        "returntarget"
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
                        "finaltarget"
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

            if (
                ellieWalkAction
            ) {

                ellieWalkAction.paused =
                    false;
            }
        }

        function stopWalk() {

            if (
                ellieWalkAction
            ) {

                ellieWalkAction.paused =
                    true;
            }
        }

        // ============================================================
        // CHOOSE FINAL FOOTPRINT
        // ============================================================

        function chooseFinalFootprint() {

            if (
                !ellieModel ||
                footprintMeshes.length === 0
            ) {

                console.error(
                    "NO FOOTPRINTS FOUND"
                );

                return null;
            }

            const ellieWorld =
                new THREE.Vector3();

            ellieModel.getWorldPosition(
                ellieWorld
            );

            let farthest =
                null;

            let farthestDistance =
                -1;

            for (
                const footprint
                of footprintMeshes
            ) {

                const footprintWorld =
                    new THREE.Vector3();

                footprint.getWorldPosition(
                    footprintWorld
                );

                const distance =
                    ellieWorld.distanceTo(
                        footprintWorld
                    );

                if (
                    distance >
                    farthestDistance
                ) {

                    farthestDistance =
                        distance;

                    farthest =
                        footprint;
                }
            }

            console.log(
                "FINAL FOOTPRINT:",
                farthest?.name
            );

            console.log(
                "FINAL DISTANCE:",
                farthestDistance
            );

            return farthest;
        }

        // ============================================================
        // GET TARGET FOR ELLIE
        // ============================================================

        function getTargetPositionForEllie(
            target
        ) {

            if (
                !target ||
                !ellieModel
            ) {

                return null;
            }

            const world =
                new THREE.Vector3();

            target.getWorldPosition(
                world
            );

            return storyRoot.worldToLocal(
                world.clone()
            );
        }

        // ============================================================
        // MOVE ELLIE
        // ============================================================

        function moveEllieTo(
            target,
            speed = ELLIE_WALK_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        !ellieModel ||
                        !target
                    ) {

                        console.warn(
                            "ELLIE TARGET MISSING"
                        );

                        resolve();

                        return;
                    }

                    const destination =
                        getTargetPositionForEllie(
                            target
                        );

                    if (!destination) {

                        resolve();

                        return;
                    }

                    // Keep current height.
                    destination.y =
                        ellieModel.position.y;

                    const initialDistance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "MOVE TARGET:",
                        target.name
                    );

                    console.log(
                        "MOVE DISTANCE:",
                        initialDistance
                    );

                    if (
                        initialDistance <
                        0.005
                    ) {

                        console.warn(
                            "TARGET TOO CLOSE TO ELLIE"
                        );

                        resolve();

                        return;
                    }

                    startWalk();

                    let previousTime =
                        performance.now();

                    function step(
                        currentTime
                    ) {

                        const deltaTime =
                            Math.min(
                                (
                                    currentTime -
                                    previousTime
                                ) / 1000,
                                0.05
                            );

                        previousTime =
                            currentTime;

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

                        if (
                            distance <=
                            0.005
                        ) {

                            ellieModel.position.x =
                                destination.x;

                            ellieModel.position.z =
                                destination.z;

                            stopWalk();

                            console.log(
                                "ELLIE ARRIVED"
                            );

                            resolve();

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
                                90
                            );

                        const movement =
                            direction
                                .normalize()
                                .multiplyScalar(
                                    Math.min(
                                        speed *
                                        deltaTime,
                                        distance
                                    )
                                );

                        ellieModel.position.add(
                            movement
                        );

                        requestAnimationFrame(
                            step
                        );
                    }

                    requestAnimationFrame(
                        step
                    );
                }
            );
        }

        // ============================================================
        // MOVE LOG
        // ============================================================

        function moveObjectToTarget(
            object,
            target,
            speed = LOG_MOVE_SPEED
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        !object ||
                        !target
                    ) {

                        resolve();

                        return;
                    }

                    const world =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        world
                    );

                    const destination =
                        object.parent
                            .worldToLocal(
                                world.clone()
                            );

                    let previousTime =
                        performance.now();

                    function step(
                        currentTime
                    ) {

                        const deltaTime =
                            Math.min(
                                (
                                    currentTime -
                                    previousTime
                                ) / 1000,
                                0.05
                            );

                        previousTime =
                            currentTime;

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
                            0.005
                        ) {

                            object.position.copy(
                                destination
                            );

                            resolve();

                            return;
                        }

                        object.position.add(
                            direction
                                .normalize()
                                .multiplyScalar(
                                    Math.min(
                                        speed *
                                        deltaTime,
                                        distance
                                    )
                                )
                        );

                        requestAnimationFrame(
                            step
                        );
                    }

                    requestAnimationFrame(
                        step
                    );
                }
            );
        }

        // ============================================================
        // INTRO SEQUENCE
        // ============================================================

        async function startIntro() {

            console.log(
                "INTRO START"
            );

            interactionLocked =
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

            console.log(
                "FOOTPRINT TAP ENABLED"
            );
        }

        // ============================================================
        // FOOTPRINT SEQUENCE
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

            lastFootprint =
                chooseFinalFootprint();

            if (!lastFootprint) {

                console.error(
                    "FINAL FOOTPRINT MISSING"
                );

                storyStage =
                    "FOOTPRINTS";

                interactionLocked =
                    false;

                sequenceRunning =
                    false;

                return;
            }

            console.log(
                "STARTING VOICE 2 + WALK"
            );

            await Promise.all([
                playVoice(2),

                moveEllieTo(
                    lastFootprint
                )
            ]);

            stopWalk();

            scene2Model.visible =
                true;

            console.log(
                "SCENE 2 SHOWN"
            );

            storyStage =
                "LOG_INSTRUCTION";

            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "LOG TAP ENABLED"
            );
        }

        // ============================================================
        // LOG SEQUENCE
        // ============================================================

        async function runLogLift() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "LOG_LIFT";

            const voice4 =
                playVoice(4);

            await moveEllieTo(
                elephantLogTarget
            );

            await moveObjectToTarget(
                logLiftObject,
                logLiftTarget
            );

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        400
                    )
            );

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget
            );

            // IMPORTANT:
            // Show Scene 3 immediately after
            // the log is moved aside.

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 SHOWN"
            );

            await voice4;

            storyStage =
                "WALK_RIVER";

            await Promise.all([
                playVoice(5),

                moveEllieTo(
                    riverTarget
                )
            ]);

            await playVoice(6);

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE TAP ENABLED"
            );
        }

        // ============================================================
        // BRIDGE
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

            const bridgeLog =
                bridgeLogs[
                    bridgeLogIndex
                ];

            if (
                bridgeStartTarget
            ) {

                await moveEllieTo(
                    bridgeStartTarget
                );
            }

            if (
                logPileTarget
            ) {

                await moveEllieTo(
                    logPileTarget
                );
            }

            if (
                sourceLog
            ) {

                sourceLog.visible =
                    false;
            }

            if (
                bridgePlaceTarget
            ) {

                await moveEllieTo(
                    bridgePlaceTarget
                );
            }

            if (
                bridgeLog
            ) {

                bridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            if (
                bridgeLogIndex >= 3
            ) {

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                scene4Model.visible =
                    true;

                if (
                    finalTarget
                ) {

                    await moveEllieTo(
                        finalTarget
                    );
                }

                await playVoice(7);

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                sequenceRunning =
                    false;

                return;
            }

            if (
                returnTarget
            ) {

                await moveEllieTo(
                    returnTarget
                );
            }

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // HANDLE STORY TAP
        // ============================================================

        function handleStoryTap() {

            console.log(
                "TAP",
                storyStage,
                "locked:",
                interactionLocked
            );

            if (
                interactionLocked ||
                sequenceRunning
            ) {

                return;
            }

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

                // Any tap for now.
                runLogLift();

                return;
            }

            if (
                storyStage ===
                "BRIDGE"
            ) {

                buildNextBridgeLog();
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

        // IMPORTANT:
        // Keep this callback synchronous.
        // Do NOT await voice/audio directly here.

        controller.addEventListener(
            "select",
            () => {

                console.log(
                    "XR SELECT EVENT"
                );

                // ====================================================
                // PLACE STORY
                // ====================================================

                if (!storyPlaced) {

                    if (
                        !reticle.visible ||
                        !scenesReady
                    ) {

                        console.log(
                            "PLACEMENT BLOCKED"
                        );

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

                    sequenceRunning =
                        true;

                    // Start async intro separately.
                    startIntro();

                    return;
                }

                // ====================================================
                // NORMAL STORY TAP
                // ====================================================

                handleStoryTap();
            }
        );

        scene.add(
            controller
        );

        // ============================================================
        // RENDER
        // ============================================================

        function render(
            timestamp,
            frame
        ) {

            const delta =
                clock.getDelta();

            if (
                ellieMixer
            ) {

                ellieMixer.update(
                    delta
                );
            }

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

                            interactionLocked =
                                true;

                            sequenceRunning =
                                false;

                            storyStage =
                                "WAITING";

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

                        if (
                            pose
                        ) {

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
                width: "100vw",
                height: "100vh",
                overflow: "hidden",
                background: "black"
            }}
        />
    );
}