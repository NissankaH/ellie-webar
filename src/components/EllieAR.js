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

        const WORLD_SCALE = 2.85;

        // Scene 1 + Scene 2 - slow walking for young children
        const ELLIE_WALK_SPEED = 0.008;

        // Scene 3 - slightly quicker for bridge building
        const ELLIE_SCENE3_SPEED = 0.03;

        const ELLIE_ROTATION_OFFSET = -90;

        // Scene 2 log movement
        const LOG_LIFT_DURATION = 1.0;
        const LOG_SIDE_DURATION = 1.5;
        const LOG_LIFT_HEIGHT = 0.08;

        // Scene 3 bridge logs
        const BRIDGE_LOG_MOVE_DURATION = 1.5;

        const TAP_DEBOUNCE_MS = 350;

        // Water
        let waterMesh = null;

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

        let storyRoot = null;

        let scene1Model = null;
        let scene2Model = null;
        let scene3Model = null;
        let scene4Model = null;

        // IMPORTANT:
        // Do NOT move scene4Model here.
        // It is still null at this point.

        // ============================================================
        // ELLIE
        // ============================================================

        let ellieModel = null;
        let ellieMixer = null;
        let ellieWalkAction = null;

        let ellieMovement = null;

        // ============================================================
        // OBJECT MOVEMENT
        // ============================================================

        let objectMovement = null;

        // ============================================================
        // SCENE 1
        // ============================================================

        let finalFootprintTarget = null;

        // ============================================================
        // SCENE 2
        // ============================================================

        let scene2Footp4Target = null;

        let logLiftObject = null;

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
        // CREATE SCENE
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
        // GLB LOADER
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
        // NAME HELPER
        // ============================================================

        function normalizeName(name) {

            return (name || "")
                .toLowerCase()
                .replace(
                    /[^a-z0-9]/g,
                    ""
                );
        }

        // ============================================================
        // FIND EXACT OBJECT
        // ============================================================

        function findExact(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ) === wanted
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        // ============================================================
        // FIND CONTAINING OBJECT
        // ============================================================

        function findContaining(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ).includes(
                            wanted
                        )
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        // ============================================================
        // FIND EXACT MESH
        // ============================================================

        function findExactMesh(
            root,
            wantedName
        ) {

            if (!root) {
                return null;
            }

            const wanted =
                normalizeName(
                    wantedName
                );

            let found = null;

            root.traverse(
                (child) => {

                    if (
                        child === root ||
                        found ||
                        !child.isMesh
                    ) {
                        return;
                    }

                    if (
                        normalizeName(
                            child.name
                        ) === wanted
                    ) {

                        found =
                            child;
                    }
                }
            );

            return found;
        }

        // ============================================================
        // WATER
        //
        // IMPORTANT:
        // Material only.
        // We are NOT modifying geometry vertices anymore.
        // ============================================================

        function setupWater() {

            if (!scene3Model) {
                return;
            }

            waterMesh =
                findExactMesh(
                    scene3Model,
                    "WaterBlock_50m"
                ) ||
                findExactMesh(
                    scene3Model,
                    "WaterBlock50m"
                );

            // Fallback in case Blender slightly changed the name
            if (!waterMesh) {

                scene3Model.traverse(
                    (child) => {

                        if (
                            waterMesh ||
                            !child.isMesh
                        ) {
                            return;
                        }

                        const name =
                            normalizeName(
                                child.name
                            );

                        if (
                            name.includes(
                                "waterblock50m"
                            )
                        ) {

                            waterMesh =
                                child;
                        }
                    }
                );
            }

            if (!waterMesh) {

                console.warn(
                    "WaterBlock_50m NOT FOUND"
                );

                return;
            }

            console.log(
                "WATER FOUND:",
                waterMesh.name
            );

            // --------------------------------------------------------
            // SAFE WEBAR WATER MATERIAL
            // --------------------------------------------------------

            waterMesh.material =
                new THREE.MeshStandardMaterial({

                    // Friendly bright river blue
                    color:
                        0x2d9fe8,

                    transparent:
                        true,

                    opacity:
                        0.82,

                    // Slightly shiny
                    roughness:
                        0.25,

                    metalness:
                        0.0,

                    side:
                        THREE.DoubleSide
                });

            waterMesh.material.needsUpdate =
                true;

            console.log(
                "BLUE WATER MATERIAL READY"
            );
        }
                // ============================================================
        // WORLD POSITION
        // ============================================================

        function getWorldPosition(
            object
        ) {

            if (!object) {
                return null;
            }

            const world =
                new THREE.Vector3();

            object.getWorldPosition(
                world
            );

            return world;
        }

        // ============================================================
        // MESH CENTER WORLD POSITION
        // ============================================================

        function getMeshCenterWorld(
            object
        ) {

            if (!object) {
                return null;
            }

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

            return getWorldPosition(
                object
            );
        }

        // ============================================================
        // MOVEMENT SAFETY
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

        // ============================================================
        // WAIT
        // ============================================================

        function wait(ms) {

            return new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );
        }

        // ============================================================
        // ALIGN SCENE 3 TO SCENE 2
        //
        // Scene2 hidden footp4 is the end of Scene2.
        // BridgeStartTarget is the beginning of Scene3.
        //
        // Move the WHOLE Scene3 so the environments connect.
        // ============================================================

        function alignScene3ToScene2() {

            if (
                !scene2Footp4Target ||
                !bridgeStartTarget ||
                !scene3Model ||
                !storyRoot
            ) {

                console.warn(
                    "SCENE 3 ALIGNMENT TARGETS MISSING",
                    {
                        scene2End:
                            scene2Footp4Target?.name,

                        scene3Start:
                            bridgeStartTarget?.name
                    }
                );

                return;
            }

            storyRoot.updateMatrixWorld(
                true
            );

            // --------------------------------------------------------
            // SCENE 2 END POSITION
            // --------------------------------------------------------

            const scene2EndWorld =
                new THREE.Vector3();

            scene2Footp4Target
                .getWorldPosition(
                    scene2EndWorld
                );

            // --------------------------------------------------------
            // SCENE 3 START POSITION
            // --------------------------------------------------------

            const scene3StartWorld =
                new THREE.Vector3();

            bridgeStartTarget
                .getWorldPosition(
                    scene3StartWorld
                );

            // --------------------------------------------------------
            // ALIGN X/Z ONLY
            //
            // Preserve Scene3's own height.
            // --------------------------------------------------------

            const desiredWorld =
                new THREE.Vector3(
                    scene2EndWorld.x,
                    scene3StartWorld.y,
                    scene2EndWorld.z
                );

            // Current Scene3 target in StoryRoot local coordinates
            const currentLocal =
                storyRoot.worldToLocal(
                    scene3StartWorld.clone()
                );

            // Desired Scene3 target in StoryRoot local coordinates
            const desiredLocal =
                storyRoot.worldToLocal(
                    desiredWorld.clone()
                );

            const localOffset =
                desiredLocal.sub(
                    currentLocal
                );

            // --------------------------------------------------------
            // MOVE ENTIRE SCENE 3
            // --------------------------------------------------------

            scene3Model.position.add(
                localOffset
            );

            storyRoot.updateMatrixWorld(
                true
            );

            console.log(
                "SCENE 3 ALIGNED TO SCENE 2"
            );
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
                // FINAL FOOTPRINT
                //
                // Handles:
                // footp__4__1
                // footp_4_1
                // etc.
                //
                // normalizeName -> footp41
                // ----------------------------------------------------

                scene1Model.traverse(
                    (child) => {

                        if (
                            normalizeName(
                                child.name
                            ) === "footp41"
                        ) {

                            finalFootprintTarget =
                                child;
                        }
                    }
                );

                console.log(
                    "SCENE 1 FINAL FOOTPRINT:",
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
                // HIDDEN FOOTP4
                //
                // Navigation target only.
                // NEVER visible.
                // ----------------------------------------------------

                scene2Model.traverse(
                    (child) => {

                        const name =
                            normalizeName(
                                child.name
                            );

                        if (
                            name ===
                            "footp4"
                        ) {

                            if (
                                !scene2Footp4Target
                            ) {

                                scene2Footp4Target =
                                    child;
                            }

                            child.visible =
                                false;
                        }
                    }
                );

                console.log(
                    "SCENE 2 HIDDEN FOOTP4:",
                    scene2Footp4Target?.name
                );

                // ----------------------------------------------------
                // ACTUAL LOG MESH
                // ----------------------------------------------------

                logLiftObject =
                    findExactMesh(
                        scene2Model,
                        "Log_Lift"
                    );

                // Fallback:
                // ONLY allow a mesh.
                if (!logLiftObject) {

                    scene2Model.traverse(
                        (child) => {

                            if (
                                logLiftObject ||
                                !child.isMesh
                            ) {

                                return;
                            }

                            const name =
                                normalizeName(
                                    child.name
                                );

                            if (
                                name.includes(
                                    "loglift"
                                ) &&
                                !name.includes(
                                    "target"
                                )
                            ) {

                                logLiftObject =
                                    child;
                            }
                        }
                    );
                }

                // ----------------------------------------------------
                // ELLIE STANDS HERE DURING LOG ACTION
                // ----------------------------------------------------

                logLiftTarget =
                    findExact(
                        scene2Model,
                        "logLiftTarget"
                    ) ||
                    findContaining(
                        scene2Model,
                        "logLiftTarget"
                    );

                // ----------------------------------------------------
                // LOG ENDS HERE
                // ----------------------------------------------------

                logSideTarget =
                    findExact(
                        scene2Model,
                        "logSideTarget"
                    ) ||
                    findContaining(
                        scene2Model,
                        "logSideTarget"
                    );

                console.log(
                    "ACTUAL LOG:",
                    logLiftObject?.name
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
                // SAFE WATER MATERIAL
                // ----------------------------------------------------

                setupWater();

                // ====================================================
                // SOURCE LOGS
                //
                // Logs Ellie carries:
                // log
                // log_1
                // log_2
                // ====================================================

                sourceLogs = [];

                const sourceParent =
                    findExact(
                        scene3Model,
                        "SourceLogs"
                    ) ||
                    findContaining(
                        scene3Model,
                        "SourceLogs"
                    );

                if (sourceParent) {

                    const validNames = [
                        "log",
                        "log1",
                        "log2"
                    ];

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
                                validNames.includes(
                                    name
                                )
                            ) {

                                sourceLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                // Keep logs in correct order.
                sourceLogs.sort(
                    (a, b) => {

                        const order = {
                            log: 0,
                            log1: 1,
                            log2: 2
                        };

                        return (
                            order[
                                normalizeName(
                                    a.name
                                )
                            ] -
                            order[
                                normalizeName(
                                    b.name
                                )
                            ]
                        );
                    }
                );

                console.log(
                    "SOURCE LOGS:",
                    sourceLogs.map(
                        (log) =>
                            log.name
                    )
                );

                // ====================================================
                // FINISHED BRIDGE LOGS
                //
                // log_3
                // log_4
                // log_5
                // ====================================================

                bridgeLogs = [];

                const bridgeParent =
                    findExact(
                        scene3Model,
                        "BridgeLogs"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgeLogs"
                    );

                if (bridgeParent) {

                    const validNames = [
                        "log3",
                        "log4",
                        "log5"
                    ];

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
                                validNames.includes(
                                    name
                                )
                            ) {

                                bridgeLogs.push(
                                    child
                                );
                            }
                        }
                    );
                }

                bridgeLogs.sort(
                    (a, b) => {

                        const order = {
                            log3: 0,
                            log4: 1,
                            log5: 2
                        };

                        return (
                            order[
                                normalizeName(
                                    a.name
                                )
                            ] -
                            order[
                                normalizeName(
                                    b.name
                                )
                            ]
                        );
                    }
                );

                // Finished bridge logs hidden initially.
                bridgeLogs.forEach(
                    (log) => {

                        log.visible =
                            false;
                    }
                );

                console.log(
                    "BRIDGE LOGS:",
                    bridgeLogs.map(
                        (log) =>
                            log.name
                    )
                );

                // ====================================================
                // SCENE 3 TARGETS
                // ====================================================

                bridgeStartTarget =
                    findExact(
                        scene3Model,
                        "BridgeStartTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgeStartTarget"
                    );

                bridgePlaceTarget =
                    findExact(
                        scene3Model,
                        "BridgePlaceTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "BridgePlaceTarget"
                    );

                logPileTarget =
                    findExact(
                        scene3Model,
                        "LogPileTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "LogPileTarget"
                    );

                riverTarget =
                    findExact(
                        scene3Model,
                        "RiverTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "RiverTarget"
                    );

                returnTarget =
                    findExact(
                        scene3Model,
                        "ReturnTarget"
                    ) ||
                    findContaining(
                        scene3Model,
                        "ReturnTarget"
                    );

                console.log(
                    "BRIDGE START TARGET:",
                    bridgeStartTarget?.name
                );

                console.log(
                    "BRIDGE PLACE TARGET:",
                    bridgePlaceTarget?.name
                );

                console.log(
                    "LOG PILE TARGET:",
                    logPileTarget?.name
                );

                console.log(
                    "RIVER TARGET:",
                    riverTarget?.name
                );

                console.log(
                    "RETURN TARGET:",
                    returnTarget?.name
                );

                // ====================================================
                // CONNECT SCENE 3 TO SCENE 2
                // ====================================================

                alignScene3ToScene2();

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
                // FINAL / MOTHER TARGET
                // ----------------------------------------------------

                finalTarget =
                    findExact(
                        scene4Model,
                        "FinalTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "FinalTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "MommyTarget"
                    ) ||
                    findContaining(
                        scene4Model,
                        "EndTarget"
                    );

                // ====================================================
                // SMALL SCENE 4 NUDGE ONLY
                //
                // IMPORTANT:
                // Keep Scene4's authored position.
                // Do NOT align it to the bridge.
                //
                // This only closes the small gap slightly.
                // ====================================================

                scene4Model.position.x -=
                    0.08;

                scene4Model.position.z +=
                    0.05;

                storyRoot.updateMatrixWorld(
                    true
                );

                console.log(
                    "SCENE 4 NUDGED SLIGHTLY CLOSER"
                );

                console.log(
                    "FINAL TARGET:",
                    finalTarget?.name
                );

                // ====================================================
                // READY
                // ====================================================

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

                    // Start paused.
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

        // ============================================================
        // START LOADING
        // ============================================================

        loadEnvironment();
        loadEllie();
                // ============================================================
        // AUDIO
        // ============================================================

        function playVoice(number) {

            return new Promise(
                (resolve) => {

                    // Stop previous voice before starting next one.
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

                                console.warn(
                                    `VOICE ${number} PLAY FAILED`,
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
        // ELLIE MOVEMENT
        // ============================================================

        function moveEllieToWorld(
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

                    // Convert world target to StoryRoot local position.
                    const destination =
                        storyRoot.worldToLocal(
                            worldPosition.clone()
                        );

                    // Keep Ellie on her current ground height.
                    destination.y =
                        ellieModel.position.y;

                    const distance =
                        ellieModel.position
                            .distanceTo(
                                destination
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

            return moveEllieToWorld(
                getWorldPosition(
                    target
                ),
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

            const direction =
                ellieMovement
                    .destination
                    .clone()
                    .sub(
                        ellieModel.position
                    );

            // Horizontal movement only.
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
                    ellieMovement
                        .destination.x;

                ellieModel.position.z =
                    ellieMovement
                        .destination.z;

                stopWalk();

                const finish =
                    ellieMovement.resolve;

                ellieMovement =
                    null;

                finish();

                return;
            }

            // --------------------------------------------------------
            // FACE WALKING DIRECTION
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
            // MOVE
            // --------------------------------------------------------

            const amount =
                Math.min(
                    ellieMovement.speed *
                    delta,
                    distance
                );

            direction.normalize();

            ellieModel.position
                .addScaledVector(
                    direction,
                    amount
                );
        }

        // ============================================================
        // SAFE OBJECT MOVEMENT
        //
        // Used for:
        // Scene 2 log
        // Scene 3 bridge logs
        //
        // Duration-based so it cannot get stuck because of scale.
        // ============================================================

        function animateObjectToWorld(
            object,
            worldDestination,
            duration
        ) {

            return new Promise(
                (resolve) => {

                    if (
                        isUnsafeMovementObject(
                            object
                        ) ||
                        !worldDestination ||
                        !object.parent
                    ) {

                        console.warn(
                            "OBJECT MOVEMENT SKIPPED:",
                            object?.name
                        );

                        resolve();

                        return;
                    }

                    const localDestination =
                        object.parent
                            .worldToLocal(
                                worldDestination.clone()
                            );

                    objectMovement = {

                        object:
                            object,

                        start:
                            object.position.clone(),

                        destination:
                            localDestination,

                        duration:
                            Math.max(
                                duration,
                                0.01
                            ),

                        elapsed:
                            0,

                        resolve:
                            resolve
                    };

                    console.log(
                        "OBJECT MOVEMENT START:",
                        object.name
                    );
                }
            );
        }

        function animateObjectToTarget(
            object,
            target,
            duration
        ) {

            if (!target) {

                console.warn(
                    "OBJECT TARGET MISSING"
                );

                return Promise.resolve();
            }

            return animateObjectToWorld(
                object,
                getWorldPosition(
                    target
                ),
                duration
            );
        }

        // ============================================================
        // UPDATE OBJECT MOVEMENT
        // ============================================================

        function updateObjectMovement(
            delta
        ) {

            if (!objectMovement) {
                return;
            }

            const movement =
                objectMovement;

            const object =
                movement.object;

            if (
                isUnsafeMovementObject(
                    object
                )
            ) {

                const finish =
                    movement.resolve;

                objectMovement =
                    null;

                finish();

                return;
            }

            movement.elapsed +=
                delta;

            let t =
                movement.elapsed /
                movement.duration;

            t =
                THREE.MathUtils.clamp(
                    t,
                    0,
                    1
                );

            // Smooth ease in/out.
            const eased =
                t * t * (3 - 2 * t);

            object.position
                .lerpVectors(
                    movement.start,
                    movement.destination,
                    eased
                );

            if (
                t >= 1
            ) {

                object.position.copy(
                    movement.destination
                );

                const finish =
                    movement.resolve;

                console.log(
                    "OBJECT MOVEMENT COMPLETE:",
                    object.name
                );

                objectMovement =
                    null;

                finish();
            }
        }

        // ============================================================
        // MOVEMENT FAILSAFE
        //
        // If something weird happens with a GLB object,
        // the story still continues.
        // ============================================================

        async function safeObjectAction(
            actionPromise,
            timeout
        ) {

            await Promise.race([

                actionPromise,

                wait(
                    timeout
                )

            ]);
        }

        // ============================================================
        // INTRO
        // ============================================================

        async function runIntro() {

            interactionLocked =
                true;

            sequenceRunning =
                true;

            storyStage =
                "INTRO";

            // Audio 1
            await playVoice(1);

            // After intro, child can tap screen.
            storyStage =
                "FOOTPRINTS";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "INTRO COMPLETE - READY FOR FIRST TAP"
            );
        }

        // ============================================================
        // SCENE 1
        //
        // Tap screen
        // -> Audio 2
        // -> Ellie slowly walks to final footprint
        // -> Scene 2 appears
        // -> Audio 3
        // ============================================================

        async function runScene1() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "SCENE1_WALK";

            const finalWorld =
                getMeshCenterWorld(
                    finalFootprintTarget
                );

            // --------------------------------------------------------
            // AUDIO 2 + ELLIE WALK TOGETHER
            // --------------------------------------------------------

            await Promise.all([

                playVoice(2),

                moveEllieToWorld(
                    finalWorld,
                    ELLIE_WALK_SPEED
                )

            ]);

            stopWalk();

            // --------------------------------------------------------
            // SHOW SCENE 2
            // --------------------------------------------------------

            if (scene2Model) {

                scene2Model.visible =
                    true;
            }

            // Hidden target must remain hidden.
            if (scene2Footp4Target) {

                scene2Footp4Target.visible =
                    false;
            }

            // --------------------------------------------------------
            // AUDIO 3
            // --------------------------------------------------------

            await playVoice(3);

            // Child can now tap to interact with log.
            storyStage =
                "LOG";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "SCENE 1 COMPLETE - LOG READY"
            );
        }

        // ============================================================
        // SCENE 2
        //
        // Tap
        // -> Audio 4
        // -> Ellie walks to logLiftTarget
        // -> log rises
        // -> log moves to logSideTarget
        // -> Scene 3 appears
        // -> Audio 5 + Ellie walk to river TOGETHER
        // -> Audio 6
        // -> bridge interaction unlocked
        // ============================================================

        async function runScene2() {

            if (sequenceRunning) {
                return;
            }

            sequenceRunning =
                true;

            interactionLocked =
                true;

            storyStage =
                "LOG_ACTION";

            console.log(
                "SCENE 2 LOG SEQUENCE START"
            );

            // --------------------------------------------------------
            // AUDIO 4
            //
            // Start it immediately.
            // Ellie can move while it is playing.
            // --------------------------------------------------------

            const voice4 =
                playVoice(4);

            // --------------------------------------------------------
            // 1. ELLIE -> LOG LIFT TARGET
            // --------------------------------------------------------

            if (logLiftTarget) {

                console.log(
                    "ELLIE -> logLiftTarget"
                );

                await moveEllieTo(
                    logLiftTarget,
                    ELLIE_WALK_SPEED
                );
            }
            else {

                console.warn(
                    "logLiftTarget NOT FOUND"
                );
            }

            stopWalk();

            await wait(300);

            // --------------------------------------------------------
            // 2. LOG LIFTS UP
            // --------------------------------------------------------

            if (
                logLiftObject &&
                !isUnsafeMovementObject(
                    logLiftObject
                )
            ) {

                const logWorld =
                    getWorldPosition(
                        logLiftObject
                    );

                const raisedWorld =
                    logWorld.clone();

                raisedWorld.y +=
                    LOG_LIFT_HEIGHT;

                console.log(
                    "LIFTING LOG:",
                    logLiftObject.name
                );

                await safeObjectAction(

                    animateObjectToWorld(
                        logLiftObject,
                        raisedWorld,
                        LOG_LIFT_DURATION
                    ),

                    2000
                );
            }
            else {

                console.warn(
                    "VALID LOG_LIFT MESH NOT FOUND"
                );
            }

            await wait(400);

            // --------------------------------------------------------
            // 3. LOG -> LOG SIDE TARGET
            // --------------------------------------------------------

            if (
                logLiftObject &&
                logSideTarget &&
                !isUnsafeMovementObject(
                    logLiftObject
                )
            ) {

                console.log(
                    "LOG -> logSideTarget"
                );

                await safeObjectAction(

                    animateObjectToTarget(
                        logLiftObject,
                        logSideTarget,
                        LOG_SIDE_DURATION
                    ),

                    2500
                );
            }
            else {

                console.warn(
                    "LOG SIDE MOVEMENT TARGET MISSING"
                );
            }

            console.log(
                "LOG PLACED"
            );

            // ========================================================
            // FINAL TIMING CHANGE
            //
            // AS SOON AS THE LOG IS PLACED:
            //
            // Scene 3 appears
            // Audio 5 starts
            // Ellie starts walking toward the river
            //
            // Audio and movement happen together.
            // ========================================================

            if (scene3Model) {

                scene3Model.visible =
                    true;
            }

            console.log(
                "SCENE 3 VISIBLE"
            );

            // --------------------------------------------------------
            // AUDIO 5 + ELLIE -> RIVER
            // --------------------------------------------------------

            if (riverTarget) {

                await Promise.all([

                    playVoice(5),

                    moveEllieTo(
                        riverTarget,
                        ELLIE_SCENE3_SPEED
                    )

                ]);
            }
            else {

                console.warn(
                    "RIVER TARGET MISSING"
                );

                await playVoice(5);
            }

            stopWalk();

            // We don't need Voice 4 to control progression anymore,
            // but this prevents an unhandled promise.
            void voice4;

            // --------------------------------------------------------
            // AUDIO 6
            // --------------------------------------------------------

            await playVoice(6);

            // --------------------------------------------------------
            // BRIDGE READY
            // --------------------------------------------------------

            storyStage =
                "BRIDGE";

            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "BRIDGE READY FOR TAP"
            );
        }

        // ============================================================
        // SCENE 3 - BUILD ONE BRIDGE LOG
        //
        // Each tap:
        //
        // Ellie -> bridge start
        // Ellie -> log pile
        // Ellie + one source log -> bridge
        // source log hides
        // finished bridge log appears
        // Ellie returns
        //
        // Repeat 3 times.
        // ============================================================

        async function buildBridgeLog() {

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

            // --------------------------------------------------------
            // 1. ELLIE -> BRIDGE START
            // --------------------------------------------------------

            if (bridgeStartTarget) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_SCENE3_SPEED
                );
            }

            // --------------------------------------------------------
            // 2. ELLIE -> LOG PILE
            // --------------------------------------------------------

            if (logPileTarget) {

                await moveEllieTo(
                    logPileTarget,
                    ELLIE_SCENE3_SPEED
                );
            }

            // --------------------------------------------------------
            // 3. LOG + ELLIE MOVE TO BRIDGE TOGETHER
            // --------------------------------------------------------

            let logPromise =
                Promise.resolve();

            if (
                sourceLog &&
                sourceLog.isMesh &&
                bridgePlaceTarget
            ) {

                logPromise =
                    safeObjectAction(

                        animateObjectToTarget(
                            sourceLog,
                            bridgePlaceTarget,
                            BRIDGE_LOG_MOVE_DURATION
                        ),

                        2500
                    );
            }

            let elliePromise =
                Promise.resolve();

            if (bridgePlaceTarget) {

                elliePromise =
                    moveEllieTo(
                        bridgePlaceTarget,
                        ELLIE_SCENE3_SPEED
                    );
            }

            await Promise.all([

                logPromise,

                elliePromise

            ]);

            stopWalk();

            // --------------------------------------------------------
            // 4. SWAP SOURCE LOG -> FINISHED BRIDGE LOG
            // --------------------------------------------------------

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
                "BRIDGE LOG COMPLETE:",
                bridgeLogIndex,
                "/ 3"
            );

            // ========================================================
            // ALL THREE BRIDGE LOGS COMPLETE
            // ========================================================

            if (
                bridgeLogIndex >= 3
            ) {

                storyStage =
                    "ENDING";

                interactionLocked =
                    true;

                stopWalk();

                console.log(
                    "FULL BRIDGE COMPLETE"
                );

                // ----------------------------------------------------
                // SHOW SCENE 4
                //
                // Scene 4 already has the SMALL manual nudge from
                // Part 2. We DO NOT reposition it here.
                // ----------------------------------------------------

                if (scene4Model) {

                    scene4Model.visible =
                        true;
                }

                // ====================================================
                // FINAL AUDIO TIMING
                //
                // Full bridge complete
                // ↓
                // wait exactly 1 second
                // ↓
                // Audio 7
                // + Ellie walks toward mother
                // ↓
                // Audio 7 ends
                // ↓
                // Audio 8 immediately
                // ====================================================

                await wait(1000);

                // ----------------------------------------------------
                // AUDIO 7 + ELLIE -> FINAL TARGET
                // ----------------------------------------------------

                if (finalTarget) {

                    await Promise.all([

                        playVoice(7),

                        moveEllieTo(
                            finalTarget,
                            ELLIE_SCENE3_SPEED
                        )

                    ]);
                }
                else {

                    console.warn(
                        "FINAL TARGET MISSING"
                    );

                    await playVoice(7);
                }

                stopWalk();

                // ----------------------------------------------------
                // AUDIO 8 IMMEDIATELY AFTER AUDIO 7
                // ----------------------------------------------------

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
            // NOT FINISHED YET:
            // RETURN ELLIE FOR NEXT BRIDGE LOG
            // ========================================================

            if (returnTarget) {

                await moveEllieTo(
                    returnTarget,
                    ELLIE_SCENE3_SPEED
                );
            }
            else if (
                bridgeStartTarget
            ) {

                await moveEllieTo(
                    bridgeStartTarget,
                    ELLIE_SCENE3_SPEED
                );
            }

            stopWalk();

            // Child can tap again.
            interactionLocked =
                false;

            sequenceRunning =
                false;

            console.log(
                "READY FOR NEXT BRIDGE TAP"
            );
        }