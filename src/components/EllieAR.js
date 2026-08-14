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

        // MUCH SLOWER Ellie walking.
        const ELLIE_WALK_SPEED = 0.025;

        // Log movement speed.
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

        // ============================================================
        // SCENE 1
        // ============================================================

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

        scene.add(
            storyRoot
        );

        // ============================================================
        // GLTF LOADER
        // ============================================================

        const loader = new GLTFLoader();

        function loadGLB(path) {
            return new Promise(
                (resolve, reject) => {

                    console.log(
                        "Loading:",
                        path
                    );

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
                        name.includes(search)
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

                // Final footprint.

                lastFootprint =
                    scene1Model.getObjectByName(
                        "footp_4_1"
                    );

                if (!lastFootprint) {

                    lastFootprint =
                        findObjectContaining(
                            scene1Model,
                            "footp_4"
                        );
                }

                console.log(
                    "LAST FOOTPRINT:",
                    lastFootprint?.name
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

                // Big log.

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

                // Ellie standing point near big log.

                elephantLogTarget =
                    findObjectContaining(
                        scene2Model,
                        "elephantlog"
                    );

                // Log raised target.

                logLiftTarget =
                    findObjectContaining(
                        scene2Model,
                        "loglifttarget"
                    );

                // Final corner / side target.

                logSideTarget =
                    findObjectContaining(
                        scene2Model,
                        "logsidetarget"
                    );

                console.log(
                    "BIG LOG:",
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
                // FINISHED BRIDGE LOGS
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

                // ----------------------------------------------------
                // TARGETS
                // ----------------------------------------------------

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
                    "SOURCE LOGS:",
                    sourceLogs.length
                );

                console.log(
                    "BRIDGE LOGS:",
                    bridgeLogs.length
                );

                console.log(
                    "RIVER TARGET:",
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

                // ----------------------------------------------------
                // WALK
                // ----------------------------------------------------

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

                    // Do NOT overlap narration.

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
        // GET TARGET POSITION
        // ============================================================

        function targetToStoryLocal(
            target
        ) {

            if (!target) {
                return null;
            }

            const worldPosition =
                new THREE.Vector3();

            target.getWorldPosition(
                worldPosition
            );

            return storyRoot.worldToLocal(
                worldPosition.clone()
            );
        }

        // ============================================================
        // SLOW ELLIE MOVEMENT
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
                            "Cannot move Ellie - target missing."
                        );

                        resolve();
                        return;
                    }

                    const destination =
                        targetToStoryLocal(
                            target
                        );

                    if (!destination) {

                        resolve();
                        return;
                    }

                    // Keep Ellie's current ground height.
                    destination.y =
                        ellieModel.position.y;

                    console.log(
                        "ELLIE MOVING TO:",
                        target.name
                    );

                    startWalk();

                    let lastTime =
                        performance.now();

                    function step(
                        currentTime
                    ) {

                        const deltaTime =
                            Math.min(
                                (
                                    currentTime -
                                    lastTime
                                ) / 1000,
                                0.05
                            );

                        lastTime =
                            currentTime;

                        const direction =
                            destination.clone()
                                .sub(
                                    ellieModel.position
                                );

                        direction.y =
                            0;

                        const distance =
                            direction.length();

                        // ------------------------------------------------
                        // ARRIVED
                        // ------------------------------------------------

                        if (
                            distance <= 0.005
                        ) {

                            ellieModel.position.x =
                                destination.x;

                            ellieModel.position.z =
                                destination.z;

                            stopWalk();

                            console.log(
                                "ELLIE ARRIVED:",
                                target.name
                            );

                            resolve();

                            return;
                        }

                        // ------------------------------------------------
                        // ROTATE
                        // ------------------------------------------------

                        if (
                            direction.lengthSq() >
                            0.000001
                        ) {

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
                        }

                        // ------------------------------------------------
                        // MOVE
                        // ------------------------------------------------

                        const moveAmount =
                            speed *
                            deltaTime;

                        const movement =
                            direction
                                .normalize()
                                .multiplyScalar(
                                    Math.min(
                                        moveAmount,
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
        // MOVE LOG TO TARGET
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

                        console.warn(
                            "LOG OR TARGET MISSING"
                        );

                        resolve();
                        return;
                    }

                    const targetWorldPosition =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        targetWorldPosition
                    );

                    const parent =
                        object.parent;

                    const localTarget =
                        parent.worldToLocal(
                            targetWorldPosition.clone()
                        );

                    let lastTime =
                        performance.now();

                    function step(
                        currentTime
                    ) {

                        const deltaTime =
                            Math.min(
                                (
                                    currentTime -
                                    lastTime
                                ) / 1000,
                                0.05
                            );

                        lastTime =
                            currentTime;

                        const direction =
                            localTarget.clone()
                                .sub(
                                    object.position
                                );

                        const distance =
                            direction.length();

                        if (
                            distance <= 0.005
                        ) {

                            object.position.copy(
                                localTarget
                            );

                            resolve();

                            return;
                        }

                        const moveAmount =
                            speed *
                            deltaTime;

                        object.position.add(
                            direction
                                .normalize()
                                .multiplyScalar(
                                    Math.min(
                                        moveAmount,
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

        const ringMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            });

        reticle =
            new THREE.Mesh(
                ringGeometry,
                ringMaterial
            );

        reticle.matrixAutoUpdate =
            false;

        reticle.visible =
            false;

        scene.add(
            reticle
        );

        // ============================================================
        // RAYCAST - BIG LOG ONLY
        // ============================================================

        const raycaster =
            new THREE.Raycaster();

        function raycastObjects(
            objects
        ) {

            const origin =
                new THREE.Vector3();

            const direction =
                new THREE.Vector3(
                    0,
                    0,
                    -1
                );

            const rotation =
                new THREE.Quaternion();

            controller.getWorldPosition(
                origin
            );

            controller.getWorldQuaternion(
                rotation
            );

            direction.applyQuaternion(
                rotation
            );

            direction.normalize();

            raycaster.set(
                origin,
                direction
            );

            return raycaster.intersectObjects(
                objects,
                true
            );
        }

        // ============================================================
        // SCENE 1 FLOW
        // ============================================================

        async function runFootprints() {

            interactionLocked =
                true;

            storyStage =
                "WALKING_FOOTPRINTS";

            console.log(
                "START FOOTPRINT WALK"
            );

            // Voice #2 + slow walking together.

            await Promise.all([
                playVoice(2),

                moveEllieTo(
                    lastFootprint,
                    ELLIE_WALK_SPEED
                )
            ]);

            // Ellie now waits exactly at final footprint.

            stopWalk();

            console.log(
                "ELLIE WAITING AT FINAL FOOTPRINT"
            );

            // ========================================================
            // SCENE 2 APPEARS
            // ========================================================

            scene2Model.visible =
                true;

            console.log(
                "SCENE 2 SHOWN"
            );

            // ========================================================
            // VOICE #3
            // ========================================================

            storyStage =
                "LOG_INSTRUCTION";

            await playVoice(3);

            // ========================================================
            // LOG NOW AVAILABLE
            // ========================================================

            storyStage =
                "LOG";

            interactionLocked =
                false;

            console.log(
                "LOG READY"
            );
        }

        // ============================================================
        // SCENE 2 FLOW
        // ============================================================

        async function runLogLift() {

            interactionLocked =
                true;

            storyStage =
                "LOG_LIFT";

            console.log(
                "START LOG SEQUENCE"
            );

            // ========================================================
            // VOICE #4 STARTS
            // ========================================================

            const voice4 =
                playVoice(4);

            // ========================================================
            // ELLIE SLOWLY APPROACHES LOG
            // ========================================================

            await moveEllieTo(
                elephantLogTarget,
                ELLIE_WALK_SPEED
            );

            // Tiny pause.

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        250
                    )
            );

            // ========================================================
            // LIFT LOG
            // ========================================================

            console.log(
                "LIFTING LOG"
            );

            await moveObjectToTarget(
                logLiftObject,
                logLiftTarget
            );

            // Small hold.

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        400
                    )
            );

            // ========================================================
            // MOVE LOG TO SIDE / CORNER
            // ========================================================

            console.log(
                "MOVING LOG TO CORNER"
            );

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget
            );

            console.log(
                "LOG PLACED AT CORNER"
            );

            // ========================================================
            // IMPORTANT FIX
            //
            // SCENE 3 SHOWS NOW.
            //
            // It does NOT wait until later anymore.
            // ========================================================

            if (scene3Model) {

                scene3Model.visible =
                    true;

                console.log(
                    "SCENE 3 IS NOW VISIBLE"
                );
            }
            else {

                console.error(
                    "SCENE 3 MODEL IS NULL!"
                );
            }

            // Wait for Voice #4 if it is still talking.

            await voice4;

            // ========================================================
            // VOICE #5 + WALK TO RIVER
            // ========================================================

            storyStage =
                "WALK_TO_RIVER";

            console.log(
                "WALKING TO RIVER"
            );

            await Promise.all([
                playVoice(5),

                moveEllieTo(
                    riverTarget,
                    ELLIE_WALK_SPEED
                )
            ]);

            stopWalk();

            // ========================================================
            // VOICE #6
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

            console.log(
                "BRIDGE READY"
            );
        }

        // ============================================================
        // BRIDGE FLOW
        // ============================================================

        async function buildNextBridgeLog() {

            if (
                bridgeLogIndex >= 3
            ) {
                return;
            }

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

            // Start near bridge.

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // Walk to pile.

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // Remove pile log.

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            // Walk back to bridge.

            if (bridgePlaceTarget) {

                await moveEllieTo(
                    bridgePlaceTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // Place one bridge log.

            if (bridgeLog) {

                bridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // FINISHED ALL 3
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                storyStage =
                    "ENDING";

                interactionLocked =
                    true;

                // Wait 1 second.

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                // Scene 4.

                scene4Model.visible =
                    true;

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget,
                        ELLIE_WALK_SPEED
                    );
                }

                // Reunion.

                await playVoice(7);

                // Ending immediately after.

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                stopWalk();

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // Return for next tap.

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

            interactionLocked =
                false;
        }

        // ============================================================
        // STORY TAP
        // ============================================================

        function handleStoryTap() {

            if (
                !storyPlaced ||
                interactionLocked
            ) {
                return;
            }

            // ========================================================
            // FOOTPRINTS
            // ========================================================
            //
            // Any tap after Voice 1.
            //
            // More child friendly.

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runFootprints();

                return;
            }

            // ========================================================
            // BIG LOG
            // ========================================================

            if (
                storyStage ===
                "LOG"
            ) {

                if (!logLiftObject) {
                    return;
                }

                const logMeshes =
                    [];

                logLiftObject.traverse(
                    (child) => {

                        if (child.isMesh) {

                            logMeshes.push(
                                child
                            );
                        }
                    }
                );

                if (
                    logLiftObject.isMesh
                ) {

                    logMeshes.push(
                        logLiftObject
                    );
                }

                const hits =
                    raycastObjects(
                        logMeshes
                    );

                if (
                    hits.length > 0
                ) {

                    runLogLift();
                }

                return;
            }

            // ========================================================
            // BRIDGE
            // ========================================================
            //
            // Each tap places one log.

            if (
                storyStage ===
                "BRIDGE"
            ) {

                buildNextBridgeLog();

                return;
            }
        }

        // ============================================================
        // XR CONTROLLER
        // ============================================================

        controller =
            renderer.xr.getController(0);

        controller.addEventListener(
            "select",
            async () => {

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

                    // Initial scenes.

                    scene1Model.visible =
                        true;

                    scene2Model.visible =
                        false;

                    scene3Model.visible =
                        false;

                    scene4Model.visible =
                        false;

                    // Bridge reset.

                    bridgeLogs.forEach(
                        (log) => {

                            log.visible =
                                false;
                        }
                    );

                    sourceLogs.forEach(
                        (log) => {

                            log.visible =
                                true;
                        }
                    );

                    bridgeLogIndex =
                        0;

                    // Show story.

                    storyRoot.visible =
                        true;

                    storyPlaced =
                        true;

                    reticle.visible =
                        false;

                    interactionLocked =
                        true;

                    storyStage =
                        "INTRO";

                    // =================================================
                    // VOICE #1
                    // =================================================

                    await playVoice(1);

                    // =================================================
                    // FOOTPRINTS NOW AVAILABLE
                    // =================================================

                    storyStage =
                        "FOOTPRINTS";

                    interactionLocked =
                        false;

                    console.log(
                        "FOOTPRINTS READY"
                    );

                    return;
                }

                // ====================================================
                // STORY INTERACTION
                // ====================================================

                handleStoryTap();
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
                clock.getDelta();

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

                            interactionLocked =
                                true;

                            storyStage =
                                "WAITING";

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
                // FLOOR
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