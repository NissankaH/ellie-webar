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

        // Ellie now walks SLOWLY everywhere.
        const ELLIE_WALK_SPEED = 0.025;

        // Log movement can remain a little faster.
        const LOG_MOVE_SPEED = 0.08;

        // Elephant model direction correction.
        const ELLIE_ROTATION_OFFSET = 90;

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
        // FIND OBJECT BY PART OF NAME
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
                // FIND ALL FOOTPRINTS
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

                    console.log(
                        "ELLIE WALK ANIMATION:",
                        gltf.animations[0].name
                    );
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
                                    "VOICE PLAY ERROR:",
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
        // FIND ACTUAL FINAL FOOTPRINT POSITION
        //
        // IMPORTANT:
        // We use the visible mesh center.
        // We do NOT trust the FBX/GLB object's pivot anymore.
        // ============================================================

        function getFinalFootprintWorldPosition() {

            if (
                !ellieModel ||
                footprintMeshes.length === 0
            ) {

                console.error(
                    "NO FOOTPRINTS AVAILABLE"
                );

                return null;
            }

            const ellieWorld =
                new THREE.Vector3();

            ellieModel.getWorldPosition(
                ellieWorld
            );

            let farthestPosition =
                null;

            let farthestDistance =
                -1;

            let farthestName =
                "";

            footprintMeshes.forEach(
                (footprint) => {

                    // Actual visible bounds.

                    const box =
                        new THREE.Box3();

                    box.setFromObject(
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
                        ellieWorld.distanceTo(
                            center
                        );

                    console.log(
                        "FOOTPRINT:",
                        footprint.name,
                        "DISTANCE:",
                        distance
                    );

                    if (
                        distance >
                        farthestDistance
                    ) {

                        farthestDistance =
                            distance;

                        farthestPosition =
                            center.clone();

                        farthestName =
                            footprint.name;
                    }
                }
            );

            console.log(
                "FINAL FOOTPRINT:",
                farthestName
            );

            console.log(
                "FINAL FOOTPRINT DISTANCE:",
                farthestDistance
            );

            return farthestPosition;
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

                    // Convert AR/world coordinate
                    // into StoryRoot local coordinate.

                    const destination =
                        storyRoot.worldToLocal(
                            worldPosition.clone()
                        );

                    // Stay on ground.
                    destination.y =
                        ellieModel.position.y;

                    const startingDistance =
                        ellieModel.position
                            .distanceTo(
                                destination
                            );

                    console.log(
                        "ELLIE START POSITION:",
                        ellieModel.position
                    );

                    console.log(
                        "ELLIE DESTINATION:",
                        destination
                    );

                    console.log(
                        "ELLIE WALK DISTANCE:",
                        startingDistance
                    );

                    if (
                        startingDistance <
                        0.001
                    ) {

                        console.warn(
                            "ELLIE DESTINATION IS TOO CLOSE"
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

                        // No vertical walking.
                        direction.y =
                            0;

                        const distance =
                            direction.length();

                        // --------------------------------------------
                        // ARRIVED
                        // --------------------------------------------

                        if (
                            distance <=
                            0.003
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
                        // SLOW MOVEMENT
                        // --------------------------------------------

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
        // MOVE ELLIE TO A TARGET EMPTY
        // ============================================================

        function moveEllieTo(
            target,
            speed = ELLIE_WALK_SPEED
        ) {

            if (!target) {

                console.warn(
                    "ELLIE TARGET IS NULL"
                );

                return Promise.resolve();
            }

            const worldPosition =
                new THREE.Vector3();

            target.getWorldPosition(
                worldPosition
            );

            return moveEllieToWorldPosition(
                worldPosition,
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

                        console.warn(
                            "LOG OR LOG TARGET MISSING"
                        );

                        resolve();

                        return;
                    }

                    const targetWorld =
                        new THREE.Vector3();

                    target.getWorldPosition(
                        targetWorld
                    );

                    const parent =
                        object.parent;

                    const localTarget =
                        parent.worldToLocal(
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
                            localTarget
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
        // FOOTPRINT FLOW
        // ============================================================

        async function runFootprints() {

            interactionLocked =
                true;

            storyStage =
                "FOOTPRINT_WALK";

            console.log(
                "FOOTPRINT SEQUENCE START"
            );

            // --------------------------------------------------------
            // FIND ACTUAL END OF FOOTPRINT PATH
            // --------------------------------------------------------

            const finalFootprintPosition =
                getFinalFootprintWorldPosition();

            if (!finalFootprintPosition) {

                console.error(
                    "FINAL FOOTPRINT POSITION NOT FOUND"
                );

                interactionLocked =
                    false;

                storyStage =
                    "FOOTPRINTS";

                return;
            }

            // --------------------------------------------------------
            // VOICE 2 AND WALK START TOGETHER
            // --------------------------------------------------------

            const voice2 =
                playVoice(2);

            const walkToFootprints =
                moveEllieToWorldPosition(
                    finalFootprintPosition,
                    ELLIE_WALK_SPEED
                );

            await Promise.all([
                voice2,
                walkToFootprints
            ]);

            // Ellie now waits.
            stopWalk();

            console.log(
                "ELLIE WAITING AT END OF FOOTPRINTS"
            );

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

            storyStage =
                "LOG_INSTRUCTION";

            await playVoice(3);

            // ========================================================
            // LOG UNLOCK
            // ========================================================

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
                "LOG SEQUENCE START"
            );

            // ========================================================
            // VOICE 4 STARTS
            // ========================================================

            const voice4 =
                playVoice(4);

            // ========================================================
            // ELLIE WALKS SLOWLY TO LOG
            // ========================================================

            await moveEllieTo(
                elephantLogTarget,
                ELLIE_WALK_SPEED
            );

            // Pause before lift.

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
                "LOG LIFTING"
            );

            await moveObjectToTarget(
                logLiftObject,
                logLiftTarget,
                LOG_MOVE_SPEED
            );

            // Hold briefly.

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        400
                    )
            );

            // ========================================================
            // MOVE LOG TO CORNER
            // ========================================================

            console.log(
                "LOG MOVING TO SIDE"
            );

            await moveObjectToTarget(
                logLiftObject,
                logSideTarget,
                LOG_MOVE_SPEED
            );

            console.log(
                "LOG AT SIDE TARGET"
            );

            // ========================================================
            // IMPORTANT:
            // SHOW SCENE 3 NOW
            //
            // DO NOT WAIT FOR VOICE 4.
            // ========================================================

            if (scene3Model) {

                scene3Model.visible =
                    true;

                console.log(
                    "SCENE 3 VISIBLE"
                );
            }
            else {

                console.error(
                    "SCENE 3 MODEL NULL"
                );
            }

            // ========================================================
            // NOW WAIT FOR VOICE 4 IF STILL PLAYING
            // ========================================================

            await voice4;

            // ========================================================
            // VOICE 5 + WALK TO RIVER
            // ========================================================

            storyStage =
                "WALK_RIVER";

            console.log(
                "ELLIE WALKING TO RIVER"
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

            const currentSource =
                sourceLogs[
                    bridgeLogIndex
                ];

            const currentBridge =
                bridgeLogs[
                    bridgeLogIndex
                ];

            // --------------------------------------------------------
            // START OF BRIDGE
            // --------------------------------------------------------

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // --------------------------------------------------------
            // WALK TO LOG PILE
            // --------------------------------------------------------

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // --------------------------------------------------------
            // PICK UP SOURCE LOG
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
                    bridgePlaceTarget,
                    ELLIE_WALK_SPEED
                );
            }

            // --------------------------------------------------------
            // PLACE BRIDGE LOG
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

                // Wait one second.

                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            1000
                        )
                );

                // ----------------------------------------------------
                // SHOW MOMMY / FINAL SCENE
                // ----------------------------------------------------

                scene4Model.visible =
                    true;

                // ----------------------------------------------------
                // OPTIONAL FINAL WALK
                // ----------------------------------------------------

                if (finalTarget) {

                    await moveEllieTo(
                        finalTarget,
                        ELLIE_WALK_SPEED
                    );
                }

                // ----------------------------------------------------
                // REUNION
                // ----------------------------------------------------

                await playVoice(7);

                // ----------------------------------------------------
                // ENDING
                // ----------------------------------------------------

                await playVoice(8);

                storyStage =
                    "COMPLETE";

                stopWalk();

                console.log(
                    "STORY COMPLETE"
                );

                return;
            }

            // --------------------------------------------------------
            // RETURN FOR NEXT LOG
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

                console.log(
                    "FOOTPRINT TAP ACCEPTED"
                );

                runFootprints();

                return;
            }

            // ========================================================
            // LOG
            // ========================================================
            //
            // For now any tap during LOG stage works,
            // because we already know this tap method is reliable.

            if (
                storyStage ===
                "LOG"
            ) {

                console.log(
                    "LOG TAP ACCEPTED"
                );

                runLogLift();

                return;
            }

            // ========================================================
            // BRIDGE
            // ========================================================

            if (
                storyStage ===
                "BRIDGE"
            ) {

                console.log(
                    "BRIDGE TAP ACCEPTED"
                );

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
                // NORMAL STORY TAP
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

                            interactionLocked =
                                true;

                            storyStage =
                                "WAITING";

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