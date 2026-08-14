"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default function EllieAR() {
    const containerRef = useRef(null);

    useEffect(() => {

        // ============================================================
        // BASIC THREE / WEBXR
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
        // STORY OBJECTS
        // ============================================================

        let storyRoot = null;

        let scene1Model = null;
        let scene2Model = null;
        let scene3Model = null;
        let scene4Model = null;

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
        let ellieReady = false;

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
            50
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

        directionalLight.position.set(2, 4, 2);

        scene.add(directionalLight);

        // ============================================================
        // RENDERER
        // ============================================================

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
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

        storyRoot.visible = false;

        scene.add(storyRoot);

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
        // HELPER - FIND OBJECT
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
                        name.includes(
                            search
                        )
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

                // Try specific final footprint first.

                lastFootprint =
                    scene1Model.getObjectByName(
                        "footp_4_1"
                    );

                // Fallback.

                if (
                    !lastFootprint &&
                    footprintMeshes.length > 0
                ) {

                    lastFootprint =
                        footprintMeshes[
                            footprintMeshes.length - 1
                        ];
                }

                console.log(
                    "Footprints:",
                    footprintMeshes.length
                );

                console.log(
                    "Last footprint:",
                    lastFootprint?.name
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
                // FIND LOG
                // ----------------------------------------------------

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

                // ----------------------------------------------------
                // FIND TARGETS
                // ----------------------------------------------------

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

                console.log(
                    "Log Lift:",
                    logLiftObject?.name
                );

                console.log(
                    "Elephant Log Target:",
                    elephantLogTarget?.name
                );

                console.log(
                    "Log Lift Target:",
                    logLiftTarget?.name
                );

                console.log(
                    "Log Side Target:",
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

                const sourceLogsParent =
                    findObjectContaining(
                        scene3Model,
                        "sourcelogs"
                    );

                if (sourceLogsParent) {

                    sourceLogsParent.traverse(
                        (child) => {

                            if (
                                child.isMesh
                            ) {

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

                            if (
                                child.isMesh
                            ) {

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

                                    // Start hidden.
                                    child.visible =
                                        false;
                                }
                            }
                        }
                    );
                }

                // ----------------------------------------------------
                // BRIDGE TARGETS
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
                    "Source Logs:",
                    sourceLogs.length
                );

                console.log(
                    "Bridge Logs:",
                    bridgeLogs.length
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

                // ----------------------------------------------------
                // FINAL TARGET
                // ----------------------------------------------------

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

                scenesReady = true;

                console.log(
                    "ALL STORY SCENES READY"
                );
            }
            catch (error) {

                console.error(
                    "Environment failed:",
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

                // ----------------------------------------------------
                // SIZE
                // ----------------------------------------------------

                ellieModel.scale.setScalar(
                    0.02
                );

                // ----------------------------------------------------
                // START
                // ----------------------------------------------------

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
                // WALK ANIMATION
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

                    console.log(
                        "Walk animation:",
                        gltf.animations[0].name
                    );
                }

                ellieReady =
                    true;

                console.log(
                    "ELLIE READY"
                );
            }
            catch (error) {

                console.error(
                    "Ellie failed:",
                    error
                );

                ellieReady =
                    false;
            }
        }

        loadEnvironment();
        loadEllie();

        // ============================================================
        // VOICE
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
                                `Audio ${number} failed`
                            );

                            resolve();
                        };

                    currentAudio
                        .play()
                        .catch(
                            (error) => {

                                console.error(
                                    "Audio play error:",
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
        // TARGET WORLD -> STORY ROOT LOCAL POSITION
        // ============================================================

        function getStoryLocalPosition(
            target
        ) {

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
            speed = 0.12
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        !ellieModel ||
                        !target
                    ) {

                        resolve();
                        return;
                    }

                    const destination =
                        getStoryLocalPosition(
                            target
                        );

                    startWalk();

                    function step() {

                        const direction =
                            destination.clone()
                                .sub(
                                    ellieModel.position
                                );

                        direction.y =
                            0;

                        const distance =
                            ellieModel.position
                                .distanceTo(
                                    destination
                                );

                        if (
                            distance < 0.01
                        ) {

                            ellieModel.position.copy(
                                destination
                            );

                            stopWalk();

                            resolve();

                            return;
                        }

                        // ------------------------------------------------
                        // ROTATE
                        // ------------------------------------------------

                        if (
                            direction.lengthSq() >
                            0.00001
                        ) {

                            const angle =
                                Math.atan2(
                                    direction.x,
                                    direction.z
                                );

                            // If Ellie walks sideways,
                            // change this offset.
                            ellieModel.rotation.y =
                                angle +
                                THREE.MathUtils.degToRad(
                                    90
                                );
                        }

                        // ------------------------------------------------
                        // MOVE
                        // ------------------------------------------------

                        const amount =
                            speed *
                            0.016;

                        ellieModel.position.copy(
                            ellieModel.position
                                .clone()
                                .lerp(
                                    destination,
                                    Math.min(
                                        amount /
                                        Math.max(
                                            distance,
                                            0.001
                                        ),
                                        1
                                    )
                                )
                        );

                        requestAnimationFrame(
                            step
                        );
                    }

                    step();
                }
            );
        }

        // ============================================================
        // MOVE LOG
        // ============================================================

        function moveObjectToTarget(
            object,
            target,
            speed = 0.15
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

                    const worldTarget =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        worldTarget
                    );

                    const parent =
                        object.parent;

                    const localTarget =
                        parent.worldToLocal(
                            worldTarget.clone()
                        );

                    function step() {

                        const distance =
                            object.position
                                .distanceTo(
                                    localTarget
                                );

                        if (
                            distance < 0.01
                        ) {

                            object.position.copy(
                                localTarget
                            );

                            resolve();

                            return;
                        }

                        const amount =
                            speed *
                            0.016;

                        object.position.lerp(
                            localTarget,
                            Math.min(
                                amount /
                                Math.max(
                                    distance,
                                    0.001
                                ),
                                1
                            )
                        );

                        requestAnimationFrame(
                            step
                        );
                    }

                    step();
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
        // RAYCAST
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
        // FOOTPRINT FLOW
        // ============================================================

        async function runFootprints() {

            interactionLocked =
                true;

            storyStage =
                "FOOTPRINT_WALK";

            console.log(
                "FOOTPRINT FLOW START"
            );

            // Voice 2 + walking together.

            await Promise.all([
                playVoice(2),

                moveEllieTo(
                    lastFootprint
                )
            ]);

            // --------------------------------------------------------
            // SHOW SCENE 2
            // --------------------------------------------------------

            scene2Model.visible =
                true;

            // --------------------------------------------------------
            // VOICE 3
            // --------------------------------------------------------

            storyStage =
                "LOG_INSTRUCTION";

            await playVoice(3);

            // --------------------------------------------------------
            // LOG UNLOCK
            // --------------------------------------------------------

            storyStage =
                "LOG";

            interactionLocked =
                false;

            console.log(
                "LOG UNLOCKED"
            );
        }

        // ============================================================
        // LOG FLOW
        // ============================================================

        async function runLogLift() {

            interactionLocked =
                true;

            storyStage =
                "LOG_LIFT";

            console.log(
                "LOG LIFT START"
            );

            // --------------------------------------------------------
            // VOICE 4 STARTS
            // --------------------------------------------------------

            const voice4 =
                playVoice(4);

            // --------------------------------------------------------
            // ELLIE APPROACHES LOG
            // --------------------------------------------------------

            await moveEllieTo(
                elephantLogTarget
            );

            // --------------------------------------------------------
            // LIFT LOG
            // --------------------------------------------------------

            await moveObjectToTarget(
                logLiftObject,
                logLiftTarget
            );

            // --------------------------------------------------------
            // MOVE LOG SIDE
            // --------------------------------------------------------

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget
            );

            // Wait for VA 4 if needed.

            await voice4;

            // --------------------------------------------------------
            // SHOW SCENE 3
            // --------------------------------------------------------

            scene3Model.visible =
                true;

            // --------------------------------------------------------
            // VOICE 5 + WALK TO RIVER
            // --------------------------------------------------------

            storyStage =
                "WALK_RIVER";

            await Promise.all([
                playVoice(5),

                moveEllieTo(
                    riverTarget
                )
            ]);

            // --------------------------------------------------------
            // VOICE 6
            // --------------------------------------------------------

            storyStage =
                "BRIDGE_INSTRUCTION";

            await playVoice(6);

            // --------------------------------------------------------
            // BRIDGE UNLOCK
            // --------------------------------------------------------

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            console.log(
                "BRIDGE UNLOCKED"
            );
        }

        // ============================================================
        // BRIDGE FLOW - ONE LOG
        // ============================================================

        async function buildNextBridgeLog() {

            if (
                bridgeLogIndex >= 3
            ) {
                return;
            }

            interactionLocked =
                true;

            const currentSource =
                sourceLogs[
                    bridgeLogIndex
                ];

            const currentBridge =
                bridgeLogs[
                    bridgeLogIndex
                ];

            // --------------------------------------------------------
            // RETURN / START
            // --------------------------------------------------------

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget
                );
            }

            // --------------------------------------------------------
            // WALK TO LOG PILE
            // --------------------------------------------------------

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget
                );
            }

            // --------------------------------------------------------
            // REMOVE SOURCE LOG
            // --------------------------------------------------------

            if (currentSource) {

                currentSource.visible =
                    false;
            }

            // --------------------------------------------------------
            // WALK TO BRIDGE
            // --------------------------------------------------------

            if (bridgePlaceTarget) {

                await moveEllieTo(
                    bridgePlaceTarget
                );
            }

            // --------------------------------------------------------
            // SNAP BRIDGE LOG
            // --------------------------------------------------------

            if (currentBridge) {

                currentBridge.visible =
                    true;
            }

            bridgeLogIndex++;

            // ========================================================
            // ALL 3 LOGS COMPLETE
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

                // ----------------------------------------------------
                // WAIT 1 SECOND
                // ----------------------------------------------------

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                // ----------------------------------------------------
                // SHOW FINAL SCENE
                // ----------------------------------------------------

                scene4Model.visible =
                    true;

                // ----------------------------------------------------
                // OPTIONAL WALK TO FINAL TARGET
                // ----------------------------------------------------

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget
                    );
                }

                // ----------------------------------------------------
                // VOICE 7
                // ----------------------------------------------------

                await playVoice(7);

                // ----------------------------------------------------
                // VOICE 8 IMMEDIATELY AFTER
                // ----------------------------------------------------

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // --------------------------------------------------------
            // RETURN FOR NEXT TAP
            // --------------------------------------------------------

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
        }

        // ============================================================
        // STORY INTERACTION
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

            if (
                storyStage ===
                "FOOTPRINTS"
            ) {

                const hits =
                    raycastObjects(
                        footprintMeshes
                    );

                if (
                    hits.length > 0
                ) {

                    runFootprints();
                }

                return;
            }

            // ========================================================
            // LOG
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
            // BRIDGE LOGS
            // ========================================================

            if (
                storyStage ===
                "BRIDGE"
            ) {

                const hits =
                    raycastObjects(
                        sourceLogs
                    );

                if (
                    hits.length > 0
                ) {

                    buildNextBridgeLog();
                }

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
                // PLACE STORY
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
                    // INITIAL VISIBILITY
                    // ------------------------------------------------

                    scene1Model.visible =
                        true;

                    scene2Model.visible =
                        false;

                    scene3Model.visible =
                        false;

                    scene4Model.visible =
                        false;

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

                    console.log(
                        "STORY PLACED"
                    );

                    // =================================================
                    // VOICE 1
                    // =================================================

                    await playVoice(1);

                    // =================================================
                    // FOOTPRINTS UNLOCK
                    // =================================================

                    storyStage =
                        "FOOTPRINTS";

                    interactionLocked =
                        false;

                    console.log(
                        "FOOTPRINTS UNLOCKED"
                    );

                    return;
                }

                // ====================================================
                // STORY TAP
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

                            interactionLocked =
                                true;

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