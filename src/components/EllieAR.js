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

        // Very slow child-friendly walking.
        const ELLIE_WALK_SPEED = 0.008;

        const LOG_MOVE_SPEED = 0.08;

        // Keep this because your elephant model previously needed
        // a 90 degree direction correction.
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

        // NEW:
        // Ellie movement state.
        //
        // Instead of using requestAnimationFrame separately,
        // the XR render loop will update this every frame.
        let ellieMovement = null;

        // ============================================================
        // SCENE 1
        // ============================================================

        let footprintMeshes = [];
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
        // LIGHTING
        // ============================================================

        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff,
            0x444444,
            3
        );

        scene.add(
            hemisphereLight
        );

        const directionalLight = new THREE.DirectionalLight(
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
        // FIND HELPERS
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

            let result = null;

            root.traverse(
                (child) => {

                    if (result) {
                        return;
                    }

                    const name =
                        child.name.toLowerCase();

                    if (
                        name.includes(search)
                    ) {
                        result = child;
                    }
                }
            );

            return result;
        }

        function findFinalFootprint(
            root
        ) {
            if (!root) {
                return null;
            }

            let result = null;

            root.traverse(
                (child) => {

                    const n =
                        child.name
                            .toLowerCase()
                            .replace(/\s/g, "");

                    if (
                        n === "footp__4__1" ||
                        n === "footp_4_1" ||
                        n === "footp.4.1" ||
                        n.includes("footp__4__1") ||
                        n.includes("footp_4_1")
                    ) {
                        result = child;
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
                // FIND FOOTPRINTS
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
                            ) ||
                            name.startsWith(
                                "footp."
                            )
                        ) {
                            footprintMeshes.push(
                                child
                            );
                        }
                    }
                );

                // ----------------------------------------------------
                // FIND EXACT FINAL FOOTPRINT
                // ----------------------------------------------------

                finalFootprintTarget =
                    findFinalFootprint(
                        scene1Model
                    );

                // Fallback to old exact name.
                if (!finalFootprintTarget) {
                    finalFootprintTarget =
                        scene1Model.getObjectByName(
                            "footp_4_1"
                        );
                }

                console.log(
                    "FOOTPRINT COUNT:",
                    footprintMeshes.length
                );

                console.log(
                    "FINAL FOOTPRINT TARGET:",
                    finalFootprintTarget?.name
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
        // GET TARGET WORLD POSITION
        // ============================================================

        function getObjectWorldPosition(
            object
        ) {
            if (!object) {
                return null;
            }

            // If it's a mesh, use its actual visible center.
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

            // Otherwise use transform position.
            const world =
                new THREE.Vector3();

            object.getWorldPosition(
                world
            );

            return world;
        }

        // ============================================================
        // START ELLIE MOVEMENT
        //
        // This creates movement STATE.
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

                    // Keep Ellie on her starting floor height.
                    destination.y =
                        ellieModel.position.y;

                    const distance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "ELLIE MOVE FROM:",
                        ellieModel.position
                    );

                    console.log(
                        "ELLIE MOVE TO:",
                        destination
                    );

                    console.log(
                        "ELLIE DISTANCE:",
                        distance
                    );

                    if (
                        distance <
                        0.001
                    ) {
                        console.warn(
                            "ELLIE TARGET TOO CLOSE"
                        );

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
        //
        // Called every WebXR frame.
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
                0.003
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

                console.log(
                    "ELLIE ARRIVED"
                );

                finish();

                return;
            }

            // --------------------------------------------------------
            // ROTATE
            // --------------------------------------------------------

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
                        ELLIE_ROTATION_OFFSET
                    );
            }

            // --------------------------------------------------------
            // MOVE
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
        // LOG MOVE
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
                        getObjectWorldPosition(
                            target
                        );

                    const destination =
                        object.parent
                            .worldToLocal(
                                targetWorld.clone()
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
                "FOOTPRINT FLOW START"
            );

            // --------------------------------------------------------
            // EXPLICIT FINAL FOOTPRINT
            // --------------------------------------------------------

            if (
                !finalFootprintTarget
            ) {
                finalFootprintTarget =
                    findFinalFootprint(
                        scene1Model
                    );
            }

            console.log(
                "MOVING ELLIE TO:",
                finalFootprintTarget?.name
            );

            const finalPosition =
                getObjectWorldPosition(
                    finalFootprintTarget
                );

            // --------------------------------------------------------
            // VOICE 2 + WALK AT SAME TIME
            // --------------------------------------------------------

            const voice2 =
                playVoice(2);

            let walkPromise =
                Promise.resolve();

            if (finalPosition) {
                walkPromise =
                    moveEllieToWorldPosition(
                        finalPosition,
                        ELLIE_WALK_SPEED
                    );
            }
            else {
                console.error(
                    "FINAL FOOTPRINT POSITION MISSING"
                );
            }

            await Promise.all([
                voice2,
                walkPromise
            ]);

            stopWalk();

            console.log(
                "ELLIE FINISHED FOOTPRINT WALK"
            );

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

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
                "LOG STAGE READY"
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

            // Slow walk to log.
            await moveEllieTo(
                elephantLogTarget,
                ELLIE_WALK_SPEED
            );

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        250
                    )
            );

            // Lift log.
            await moveObjectToTarget(
                logLiftObject,
                logLiftTarget,
                LOG_MOVE_SPEED
            );

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        400
                    )
            );

            // Move log aside.
            await moveObjectToTarget(
                logLiftObject,
                logSideTarget,
                LOG_MOVE_SPEED
            );

            // Show Scene 3 immediately.
            scene3Model.visible =
                true;

            console.log(
                "SCENE 3 VISIBLE"
            );

            await voice4;

            // Voice 5 + slow walk to river.
            await Promise.all([
                playVoice(5),

                moveEllieTo(
                    riverTarget,
                    ELLIE_WALK_SPEED
                )
            ]);

            stopWalk();

            await playVoice(6);

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE STAGE READY"
            );
        }

        // ============================================================
        // BRIDGE FLOW
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

            if (bridgeStartTarget) {
                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            if (logPileTarget) {
                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            if (sourceLog) {
                sourceLog.visible =
                    false;
            }

            if (bridgePlaceTarget) {
                await moveEllieTo(
                    bridgePlaceTarget,
                    ELLIE_WALK_SPEED
                );
            }

            if (bridgeLog) {
                bridgeLog.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // COMPLETE
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

                scene4Model.visible =
                    true;

                if (finalTarget) {
                    await moveEllieTo(
                        finalTarget,
                        ELLIE_WALK_SPEED
                    );
                }

                await playVoice(7);

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                interactionLocked =
                    true;

                sequenceRunning =
                    false;

                stopWalk();

                return;
            }

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

            sequenceRunning =
                false;
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

            console.log(
                "SCREEN TAP:",
                storyStage
            );

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
                runLogLift();
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
                // INITIAL STORY PLACEMENT
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

                    console.log(
                        "STORY PLACED"
                    );

                    runIntro();

                    return;
                }

                // Story progression tap.
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

            // Animation.
            if (ellieMixer) {
                ellieMixer.update(
                    delta
                );
            }

            // ========================================================
            // IMPORTANT FIX
            //
            // ACTUAL ELLIE TRANSLATION NOW HAPPENS HERE,
            // INSIDE THE XR RENDER LOOP.
            // ========================================================

            updateEllieMovement(
                delta
            );

            // ========================================================
            // XR
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

                            ellieMovement =
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