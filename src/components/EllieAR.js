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
        // THREE / XR
        // ============================================================

        let scene;
        let camera;
        let renderer;
        let controller;
        let reticle;

        const clock = new THREE.Clock();

        let hitTestSource = null;
        let hitTestSourceRequested = false;

        // ============================================================
        // ROOT + SCENES
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
        let finalFootprint = null;

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

        // ============================================================
        // MOVEMENT STATE
        //
        // Movement is updated INSIDE the XR render loop.
        // ============================================================

        let ellieMove = null;
        let objectMove = null;

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
        // LIGHTING
        // ============================================================

        const hemi = new THREE.HemisphereLight(
            0xffffff,
            0x444444,
            3
        );

        scene.add(hemi);

        const directional = new THREE.DirectionalLight(
            0xffffff,
            2
        );

        directional.position.set(
            2,
            4,
            2
        );

        scene.add(directional);

        // ============================================================
        // RENDERER
        // ============================================================

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

        // ============================================================
        // AR BUTTON
        // ============================================================

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

        // ============================================================
        // STORY ROOT
        // ============================================================

        storyRoot = new THREE.Group();

        storyRoot.scale.setScalar(
            WORLD_SCALE
        );

        storyRoot.visible = false;

        scene.add(storyRoot);

        // ============================================================
        // LOADER
        // ============================================================

        const loader = new GLTFLoader();

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
                                "Failed:",
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
            text
        ) {

            if (!root) {
                return null;
            }

            const search =
                text.toLowerCase();

            let found = null;

            root.traverse(
                (child) => {

                    if (found) {
                        return;
                    }

                    if (
                        child.name
                            .toLowerCase()
                            .includes(search)
                    ) {

                        found = child;
                    }
                }
            );

            return found;
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

                footprintMeshes = [];

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
                                "Footprint:",
                                child.name
                            );
                        }
                    }
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

                const sourceParent =
                    findObjectContaining(
                        scene3Model,
                        "sourcelogs"
                    );

                if (sourceParent) {

                    sourceParent.traverse(
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

                const bridgeParent =
                    findObjectContaining(
                        scene3Model,
                        "bridgelogs"
                    );

                if (bridgeParent) {

                    bridgeParent.traverse(
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

                scenesReady = true;

                console.log(
                    "ALL SCENES READY"
                );

            }
            catch (error) {

                console.error(
                    "Environment loading error:",
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
                    "Ellie loading error:",
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
                                `Voice ${number} finished`
                            );

                            resolve();
                        };

                    currentAudio.onerror =
                        () => {

                            console.error(
                                `Voice ${number} failed`
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
        // FIND FINAL FOOTPRINT USING MESH CENTER
        // ============================================================

        function chooseFinalFootprint() {

            if (
                !ellieModel ||
                footprintMeshes.length === 0
            ) {

                return null;
            }

            const ellieWorld =
                new THREE.Vector3();

            ellieModel.getWorldPosition(
                ellieWorld
            );

            let best = null;
            let bestDistance = -1;

            for (
                const footprint
                of footprintMeshes
            ) {

                // Use actual mesh bounding box center,
                // not just its transform origin.

                const box =
                    new THREE.Box3()
                        .setFromObject(
                            footprint
                        );

                const center =
                    new THREE.Vector3();

                box.getCenter(
                    center
                );

                const distance =
                    center.distanceTo(
                        ellieWorld
                    );

                if (
                    distance >
                    bestDistance
                ) {

                    bestDistance =
                        distance;

                    best =
                        {
                            object:
                                footprint,

                            worldPosition:
                                center.clone()
                        };
                }
            }

            console.log(
                "Final footprint:",
                best?.object?.name
            );

            console.log(
                "Distance:",
                bestDistance
            );

            return best;
        }

        // ============================================================
        // START ELLIE MOVE
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

                    // Ellie is under storyRoot.
                    // Convert world -> StoryRoot local.

                    const destination =
                        storyRoot.worldToLocal(
                            worldPosition.clone()
                        );

                    // Keep current ground height.

                    destination.y =
                        ellieModel.position.y;

                    const distance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "Ellie destination:",
                        destination
                    );

                    console.log(
                        "Distance:",
                        distance
                    );

                    if (
                        distance < 0.001
                    ) {

                        console.warn(
                            "Ellie destination too close."
                        );

                        resolve();
                        return;
                    }

                    startWalk();

                    // This is handled in XR render().
                    ellieMove =
                        {
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

        function moveEllieToTarget(
            target,
            speed = ELLIE_WALK_SPEED
        ) {

            if (!target) {

                return Promise.resolve();
            }

            const world =
                new THREE.Vector3();

            target.getWorldPosition(
                world
            );

            return moveEllieToWorldPosition(
                world,
                speed
            );
        }

        // ============================================================
        // UPDATE ELLIE MOVE
        // ============================================================

        function updateEllieMove(
            deltaTime
        ) {

            if (
                !ellieMove ||
                !ellieModel
            ) {

                return;
            }

            const destination =
                ellieMove.destination;

            const direction =
                destination.clone()
                    .sub(
                        ellieModel.position
                    );

            direction.y =
                0;

            const distance =
                direction.length();

            if (
                distance <= 0.003
            ) {

                ellieModel.position.x =
                    destination.x;

                ellieModel.position.z =
                    destination.z;

                stopWalk();

                const resolve =
                    ellieMove.resolve;

                ellieMove =
                    null;

                console.log(
                    "ELLIE ARRIVED"
                );

                resolve();

                return;
            }

            // --------------------------------------------------------
            // ROTATE
            // --------------------------------------------------------

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

            // --------------------------------------------------------
            // MOVE
            // --------------------------------------------------------

            const movement =
                Math.min(
                    ellieMove.speed *
                    deltaTime,
                    distance
                );

            direction
                .normalize()
                .multiplyScalar(
                    movement
                );

            ellieModel.position.add(
                direction
            );
        }

        // ============================================================
        // START OBJECT MOVE
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

                    const targetWorld =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        targetWorld
                    );

                    const destination =
                        object.parent
                            .worldToLocal(
                                targetWorld.clone()
                            );

                    objectMove =
                        {
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

        // ============================================================
        // UPDATE OBJECT MOVE
        // ============================================================

        function updateObjectMove(
            deltaTime
        ) {

            if (!objectMove) {
                return;
            }

            const object =
                objectMove.object;

            const direction =
                objectMove.destination
                    .clone()
                    .sub(
                        object.position
                    );

            const distance =
                direction.length();

            if (
                distance <= 0.003
            ) {

                object.position.copy(
                    objectMove.destination
                );

                const resolve =
                    objectMove.resolve;

                objectMove =
                    null;

                resolve();

                return;
            }

            const movement =
                Math.min(
                    objectMove.speed *
                    deltaTime,
                    distance
                );

            direction
                .normalize()
                .multiplyScalar(
                    movement
                );

            object.position.add(
                direction
            );
        }

        // ============================================================
        // INTRO
        // ============================================================

        async function startIntro() {

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
                "FOOTPRINT TAP READY"
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

            finalFootprint =
                chooseFinalFootprint();

            if (!finalFootprint) {

                console.error(
                    "No final footprint."
                );

                interactionLocked =
                    false;

                sequenceRunning =
                    false;

                storyStage =
                    "FOOTPRINTS";

                return;
            }

            console.log(
                "VOICE 2 + WALK START"
            );

            await Promise.all([

                playVoice(2),

                moveEllieToWorldPosition(
                    finalFootprint.worldPosition
                )
            ]);

            stopWalk();

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

            console.log(
                "SCENE 2 SHOW"
            );

            // ========================================================
            // VOICE 3
            // ========================================================

            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "LOG READY"
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

            // Ellie approaches log.

            await moveEllieToTarget(
                elephantLogTarget
            );

            // Lift.

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

            // Put log in corner.

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget
            );

            // ========================================================
            // SCENE 3 APPEARS HERE
            // ========================================================

            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 SHOW"
            );

            await voice4;

            // ========================================================
            // VOICE 5 + WALK TO RIVER
            // ========================================================

            await Promise.all([

                playVoice(5),

                moveEllieToTarget(
                    riverTarget
                )
            ]);

            // ========================================================
            // VOICE 6
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

                await moveEllieToTarget(
                    bridgeStartTarget
                );
            }

            if (
                logPileTarget
            ) {

                await moveEllieToTarget(
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

                await moveEllieToTarget(
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

            // ========================================================
            // ALL 3 DONE
            // ========================================================

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

                if (finalTarget) {

                    await moveEllieToTarget(
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

                await moveEllieToTarget(
                    returnTarget
                );
            }

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // STORY TAP
        // ============================================================

        function handleStoryTap() {

            console.log(
                "STORY TAP:",
                storyStage,
                interactionLocked
            );

            if (
                !storyPlaced ||
                interactionLocked ||
                sequenceRunning
            ) {

                return;
            }

            // --------------------------------------------------------
            // FOOTPRINTS
            // --------------------------------------------------------

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runFootprints();

                return;
            }

            // --------------------------------------------------------
            // LOG
            // --------------------------------------------------------

            if (
                storyStage ===
                "LOG"
            ) {

                runLogLift();

                return;
            }

            // --------------------------------------------------------
            // BRIDGE
            // --------------------------------------------------------

            if (
                storyStage ===
                "BRIDGE"
            ) {

                buildNextBridgeLog();
            }
        }

        // ============================================================
        // NORMAL PHONE TAP
        //
        // THIS handles story interactions.
        // ============================================================

        function handlePointerDown(event) {

            if (!storyPlaced) {
                return;
            }

            handleStoryTap();
        }

        renderer.domElement.addEventListener(
            "pointerdown",
            handlePointerDown
        );

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
        //
        // ONLY used for initial placement.
        // ============================================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            () => {

                if (storyPlaced) {

                    // Story interaction is handled
                    // by pointerdown instead.

                    return;
                }

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

                // ---------------------------------
                // INITIAL STATE
                // ---------------------------------

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

                interactionLocked =
                    true;

                sequenceRunning =
                    true;

                console.log(
                    "STORY PLACED"
                );

                // Don't await inside XR event.
                startIntro();
            }
        );

        scene.add(
            controller
        );

        // ============================================================
        // RENDER LOOP
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
            // ANIMATION
            // ========================================================

            if (ellieMixer) {

                ellieMixer.update(
                    delta
                );
            }

            // ========================================================
            // MOVEMENT
            //
            // THIS is the important fix.
            // ========================================================

            updateEllieMove(
                delta
            );

            updateObjectMove(
                delta
            );

            // ========================================================
            // XR HIT TEST
            // ========================================================

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

                            ellieMove =
                                null;

                            objectMove =
                                null;

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

            renderer.domElement.removeEventListener(
                "pointerdown",
                handlePointerDown
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