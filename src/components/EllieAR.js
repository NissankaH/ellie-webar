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

        // Very slow walking for Ellie.
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
                searchText.toLowerCase();

            let result = null;

            root.traverse(
                (child) => {

                    if (result) {
                        return;
                    }

                    const name =
                        child.name
                            .toLowerCase();

                    if (
                        name.includes(search)
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
                // FIND ALL FOOTPRINTS
                // ----------------------------------------------------

                footprintMeshes = [];

                scene1Model.traverse(
                    (child) => {

                        const name =
                            child.name
                                .toLowerCase();

                        if (
                            child.isMesh &&
                            (
                                name === "footp" ||
                                name.startsWith(
                                    "footp_"
                                )
                            )
                        ) {

                            footprintMeshes.push(
                                child
                            );

                            console.log(
                                "FOOTPRINT FOUND:",
                                child.name
                            );
                        }
                    }
                );

                console.log(
                    "TOTAL FOOTPRINTS:",
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

                    currentAudio.play()
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
        // FIND FARTHEST FOOTPRINT
        // ============================================================

        function chooseFinalFootprint() {

            if (
                !ellieModel ||
                footprintMeshes.length === 0
            ) {

                console.error(
                    "Cannot choose final footprint."
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

            footprintMeshes.forEach(
                (footprint) => {

                    const footprintWorld =
                        new THREE.Vector3();

                    footprint.getWorldPosition(
                        footprintWorld
                    );

                    const distance =
                        ellieWorld.distanceTo(
                            footprintWorld
                        );

                    console.log(
                        footprint.name,
                        "distance:",
                        distance
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
            );

            console.log(
                "FINAL FOOTPRINT CHOSEN:",
                farthest?.name
            );

            return farthest;
        }

        // ============================================================
        // CONVERT TARGET POSITION TO ELLIE'S PARENT SPACE
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

            const worldPosition =
                new THREE.Vector3();

            target.getWorldPosition(
                worldPosition
            );

            // Ellie is a child of StoryRoot.
            // Convert world position back to StoryRoot local space.

            const localPosition =
                storyRoot.worldToLocal(
                    worldPosition.clone()
                );

            return localPosition;
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

                        console.error(
                            "MOVE FAILED - Ellie or target missing."
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

                    // Keep Ellie on her current ground height.
                    destination.y =
                        ellieModel.position.y;

                    console.log(
                        "ELLIE START:",
                        ellieModel.position
                    );

                    console.log(
                        "ELLIE DESTINATION:",
                        destination
                    );

                    const startDistance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "WALK DISTANCE:",
                        startDistance
                    );

                    // This catches the actual problem immediately.
                    if (
                        startDistance <
                        0.005
                    ) {

                        console.error(
                            "Destination is basically Ellie's current position!"
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
                            destination.clone()
                                .sub(
                                    ellieModel.position
                                );

                        direction.y =
                            0;

                        const distance =
                            direction.length();

                        if (
                            distance <= 0.005
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

                        // --------------------------------------------
                        // FACE WALKING DIRECTION
                        // --------------------------------------------

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

                        // --------------------------------------------
                        // MOVE
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

                    const targetWorld =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        targetWorld
                    );

                    const localTarget =
                        object.parent.worldToLocal(
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

                        object.position.add(
                            direction.normalize()
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
        // FOOTPRINT FLOW
        // ============================================================

        async function runFootprints() {

            interactionLocked =
                true;

            storyStage =
                "WALKING_FOOTPRINTS";

            // Choose actual final footprint NOW,
            // after everything is positioned in AR.

            lastFootprint =
                chooseFinalFootprint();

            if (!lastFootprint) {

                console.error(
                    "NO FINAL FOOTPRINT!"
                );

                interactionLocked =
                    false;

                storyStage =
                    "FOOTPRINTS";

                return;
            }

            // Voice #2 starts immediately.

            const voice2 =
                playVoice(2);

            // Ellie simultaneously starts walking.

            const walking =
                moveEllieTo(
                    lastFootprint,
                    ELLIE_WALK_SPEED
                );

            await Promise.all([
                voice2,
                walking
            ]);

            stopWalk();

            console.log(
                "FOOTPRINT SEQUENCE COMPLETE"
            );

            // ========================================================
            // SCENE 2
            // ========================================================

            scene2Model.visible =
                true;

            // ========================================================
            // VOICE 3
            // ========================================================

            storyStage =
                "LOG_INSTRUCTION";

            await playVoice(3);

            storyStage =
                "LOG";

            interactionLocked =
                false;
        }

        // ============================================================
        // LOG FLOW
        // ============================================================

        async function runLogLift() {

            interactionLocked =
                true;

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

            scene3Model.visible =
                true;

            await voice4;

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
        }

        // ============================================================
        // BRIDGE
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

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget
                );
            }

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget
                );
            }

            if (sourceLog) {

                sourceLog.visible =
                    false;
            }

            if (bridgePlaceTarget) {

                await moveEllieTo(
                    bridgePlaceTarget
                );
            }

            if (bridgeLog) {

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

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget
                    );
                }

                await playVoice(7);
                await playVoice(8);

                storyStage =
                    "COMPLETE";

                return;
            }

            if (returnTarget) {

                await moveEllieTo(
                    returnTarget
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

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                runFootprints();
                return;
            }

            // For reliability, accept any tap during log stage too.
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
            }
        }

        // ============================================================
        // CONTROLLER
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

                    scene1Model.visible =
                        true;

                    scene2Model.visible =
                        false;

                    scene3Model.visible =
                        false;

                    scene4Model.visible =
                        false;

                    sourceLogs.forEach(
                        (log) =>
                            log.visible = true
                    );

                    bridgeLogs.forEach(
                        (log) =>
                            log.visible = false
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

                    storyStage =
                        "INTRO";

                    // Voice #1 completely finishes first.

                    await playVoice(1);

                    storyStage =
                        "FOOTPRINTS";

                    interactionLocked =
                        false;

                    console.log(
                        "FOOTPRINTS READY"
                    );

                    return;
                }

                handleStoryTap();
            }
        );

        scene.add(controller);

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