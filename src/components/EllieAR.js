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

        // Slow Ellie everywhere.
        const ELLIE_WALK_SPEED = 0.025;

        const LOG_MOVE_SPEED = 0.08;

        // Change if Ellie faces sideways.
        const ELLIE_ROTATION_OFFSET = 90;

        // Prevent one physical tap from firing twice.
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
        // STORY ROOT + MODELS
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
                searchText.toLowerCase();

            let found = null;

            root.traverse(
                (child) => {

                    if (found) {
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

                const scene1GLB =
                    await loadGLB(
                        "/models/Scene1.glb"
                    );

                scene1Model =
                    scene1GLB.scene;

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

                console.log(
                    "Footprint count:",
                    footprintMeshes.length
                );

                // ====================================================
                // SCENE 2
                // ====================================================

                const scene2GLB =
                    await loadGLB(
                        "/models/Scene2.glb"
                    );

                scene2Model =
                    scene2GLB.scene;

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

                const scene3GLB =
                    await loadGLB(
                        "/models/Scene3.glb"
                    );

                scene3Model =
                    scene3GLB.scene;

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

                console.log(
                    "Source logs:",
                    sourceLogs.length
                );

                console.log(
                    "Bridge logs:",
                    bridgeLogs.length
                );

                console.log(
                    "River target:",
                    riverTarget?.name
                );

                // ====================================================
                // SCENE 4
                // ====================================================

                const scene4GLB =
                    await loadGLB(
                        "/models/Scene4.glb"
                    );

                scene4Model =
                    scene4GLB.scene;

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

                if (!finalTarget) {

                    finalTarget =
                        findObjectContaining(
                            scene4Model,
                            "endtarget"
                        );
                }

                if (!finalTarget) {

                    finalTarget =
                        findObjectContaining(
                            scene4Model,
                            "mommytarget"
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
        // GET FARTHEST FOOTPRINT POSITION
        // ============================================================

        function getFinalFootprintWorldPosition() {

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

            let bestPosition =
                null;

            let bestDistance =
                -1;

            footprintMeshes.forEach(
                (footprint) => {

                    const box =
                        new THREE.Box3()
                            .setFromObject(
                                footprint
                            );

                    if (box.isEmpty()) {
                        return;
                    }

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

                        bestPosition =
                            center.clone();
                    }
                }
            );

            console.log(
                "Final footprint distance:",
                bestDistance
            );

            return bestPosition;
        }

        // ============================================================
        // MOVE ELLIE TO WORLD POSITION
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

                    // Keep Ellie grounded.
                    destination.y =
                        ellieModel.position.y;

                    const startDistance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "ELLIE WALK DISTANCE:",
                        startDistance
                    );

                    if (
                        startDistance <
                        0.002
                    ) {

                        console.warn(
                            "ELLIE TARGET TOO CLOSE"
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
                            0.003
                        ) {

                            ellieModel.position.x =
                                destination.x;

                            ellieModel.position.z =
                                destination.z;

                            stopWalk();

                            resolve();

                            return;
                        }

                        // --------------------------------------------
                        // ROTATE
                        // --------------------------------------------

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

                        // --------------------------------------------
                        // MOVE SLOWLY
                        // --------------------------------------------

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
        // MOVE ELLIE TO TARGET EMPTY
        // ============================================================

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
                        object.parent.worldToLocal(
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
                            0.003
                        ) {

                            object.position.copy(
                                destination
                            );

                            resolve();

                            return;
                        }

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

                        object.position.add(
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

            // ========================================================
            // ANY TAP CAN NOW START THE STORY
            // ========================================================

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
        // FOOTPRINT FLOW
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
                "START FOOTPRINT SEQUENCE"
            );

            const destination =
                getFinalFootprintWorldPosition();

            // Voice #2 starts immediately.

            const voice2 =
                playVoice(2);

            if (destination) {

                // Ellie walks while Voice #2 talks.

                await Promise.all([
                    voice2,

                    moveEllieToWorldPosition(
                        destination,
                        ELLIE_WALK_SPEED
                    )
                ]);
            }
            else {

                // Even if footprint target fails,
                // do NOT block story progression.

                console.warn(
                    "FOOTPRINT TARGET FAILED - CONTINUING STORY"
                );

                await voice2;
            }

            stopWalk();

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

            console.log(
                "SCENE 2 VISIBLE"
            );

            // ========================================================
            // VOICE 3
            // ========================================================

            await playVoice(3);

            // ========================================================
            // ANY TAP NOW MOVES THE LOG
            // ========================================================

            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "LOG STAGE - TAP ANYWHERE"
            );
        }

        // ============================================================
        // LOG FLOW
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

            // Ellie slowly approaches log.

            await moveEllieTo(
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

            // Put aside.

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget
            );

            // ========================================================
            // SCENE 3 APPEARS IMMEDIATELY
            // ========================================================

            if (scene3Model) {

                scene3Model.visible =
                    true;

                console.log(
                    "SCENE 3 VISIBLE"
                );
            }

            await voice4;

            // ========================================================
            // VOICE 5 + WALK TO RIVER
            // ========================================================

            await Promise.all([
                playVoice(5),

                moveEllieTo(
                    riverTarget
                )
            ]);

            stopWalk();

            // ========================================================
            // VOICE 6
            // ========================================================

            await playVoice(6);

            // ========================================================
            // BRIDGE TAPS
            // ========================================================

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE - TAP ANYWHERE"
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

            // Walk to starting point.

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget
                );
            }

            // Walk to log pile.

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget
                );
            }

            // Pick up log.

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            // Walk to bridge.

            if (bridgePlaceTarget) {

                await moveEllieTo(
                    bridgePlaceTarget
                );
            }

            // Place log.

            if (bridgeLog) {

                bridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // BRIDGE COMPLETE
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                storyStage =
                    "ENDING";

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                // Final scene.

                scene4Model.visible =
                    true;

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget
                    );
                }

                // Reunion.

                await playVoice(7);

                // Ending.

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                interactionLocked =
                    true;

                sequenceRunning =
                    false;

                stopWalk();

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // Return for next log.

            if (returnTarget) {

                await moveEllieTo(
                    returnTarget
                );
            }
            else if (
                bridgeStartTarget
            ) {

                await moveEllieTo(
                    bridgeStartTarget
                );
            }

            interactionLocked =
                false;

            sequenceRunning =
                false;
        }

        // ============================================================
        // STORY TAP
        //
        // NO RAYCAST.
        // NO SMALL OBJECT TARGET.
        // ANY SCREEN TAP ADVANCES CURRENT STAGE.
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
                "SCREEN TAP:",
                storyStage
            );

            // --------------------------------------------------------
            // AFTER INTRO
            // --------------------------------------------------------

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runFootprints();

                return;
            }

            // --------------------------------------------------------
            // AFTER VOICE 3
            // --------------------------------------------------------

            if (
                storyStage ===
                "LOG"
            ) {

                runLogLift();

                return;
            }

            // --------------------------------------------------------
            // AFTER VOICE 6
            // --------------------------------------------------------

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
                // FIRST SELECT = PLACE STORY
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

                    // Initial scene visibility.

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

                    console.log(
                        "STORY PLACED"
                    );

                    // Don't await inside select.
                    runIntro();

                    return;
                }

                // ====================================================
                // ANY XR TAP AFTER PLACEMENT
                // ====================================================

                handleStoryTap();
            }
        );

        scene.add(
            controller
        );

        // ============================================================
        // EXTRA PHONE TOUCH FALLBACK
        //
        // If Chrome sends normal touch events too,
        // those also advance the story.
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

            if (ellieMixer) {

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

                // ====================================================
                // HIT TEST
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