import type { Infrastructure } from "@fesmu/contract/fesmu/entity/v1/infrastructure.entity_pb";
import type { FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import building from "./model/building-1.json";

/* Floor plans of Учебный корпус № 1 from the building's digital model
 * (university_model.html): a rough vectorisation of the printed plans, in
 * relative units, not metres. A plan room is tied to a room in the database
 * by floor and number ("ауд. 210А" ↔ 210А), named ones by name. */

type Point = [number, number];
interface ModelRoom {
    number: string;
    name: string;
    kind: string;
    polygon: Point[];
}
interface ModelFloor {
    floor: number;
    outline: Point[];
    rooms: ModelRoom[];
    walls: [number, number, number, number][];
}
const FLOORS = (building as unknown as { floors: ModelFloor[] }).floors;

/** Plan names that differ from the room's title in the database. */
const MODEL_NAME_TO_TITLE: Record<string, string> = { "Биб.": "Библиотека" };

const FLOOR_GAP = 46;
const ROOM_HEIGHT = 4;
const WALL_HEIGHT = 9;
const WALL_THICKNESS = 1;

const COLOR = {
    slab: 0x94a3b8,
    wall: 0x64748b,
    space: 0xcbd5e1,
    room: 0xe2e8f0,
    match: 0x0ea5e9,
    selected: 0xf59e0b,
    hover: 0x38bdf8,
};

const roomKey = (floor: number, label: string) => `${floor}:${label.toLowerCase()}`;
const titleToLabel = (title: string) => title.replace(/^ауд\.\s*/i, "").trim();

const planBounds = () => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const floor of FLOORS)
        for (const [x, y] of floor.outline) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX };
};

/** Plan polygon → shape in the horizontal plane once rotated by +90° about X:
 * plan x stays x, plan y becomes scene z, extrusion goes down (hence the lift). */
const toShape = (polygon: Point[], cx: number, cy: number) =>
    new THREE.Shape(polygon.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));

interface RoomMesh {
    mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
    item?: Infrastructure;
    base: number;
}

interface InfrastructureModelProps {
    /** Every room from the database, to tie plan rooms to records. */
    list: Infrastructure[];
    /** Rooms that pass the page filter; they are drawn highlighted. */
    highlighted: Set<bigint>;
    /** Floors to show; empty shows the whole building. */
    floors: number[];
    selectedId?: bigint;
    onSelect: (id: bigint | undefined) => void;
}

const InfrastructureModel: FC<InfrastructureModelProps> = ({ list, highlighted, floors, selectedId, onSelect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{
        rooms: RoomMesh[];
        floorGroups: Map<number, THREE.Group>;
        labels: Map<number, CSS2DObject[]>;
        controls: OrbitControls;
        hovered?: RoomMesh;
        render: () => void;
    } | undefined>(undefined);
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    const itemsByKey = useMemo(() => {
        const map = new Map<string, Infrastructure>();
        for (const item of list) map.set(roomKey(item.floor, titleToLabel(item.title)), item);
        return map;
    }, [list]);

    // The scene is built once per room list; filter and selection changes only
    // recolour or hide what is already there.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const { cx, cy, width } = planBounds();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 1, 10000);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const labelRenderer = new CSS2DRenderer();
        labelRenderer.domElement.style.position = "absolute";
        labelRenderer.domElement.style.inset = "0";
        labelRenderer.domElement.style.pointerEvents = "none";
        container.appendChild(labelRenderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2.05;
        controls.target.set(0, FLOOR_GAP * 2, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 2.2));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(-300, 800, 500);
        scene.add(sun);

        const rooms: RoomMesh[] = [];
        const floorGroups = new Map<number, THREE.Group>();
        const labels = new Map<number, CSS2DObject[]>();
        const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
        const wallMaterial = new THREE.MeshStandardMaterial({ color: COLOR.wall, transparent: true, opacity: 0.55 });
        const slabMaterial = new THREE.MeshStandardMaterial({ color: COLOR.slab, transparent: true, opacity: 0.35, side: THREE.DoubleSide });

        for (const floor of FLOORS) {
            const group = new THREE.Group();
            group.position.y = (floor.floor - 1) * FLOOR_GAP;
            floorGroups.set(floor.floor, group);
            scene.add(group);

            const slab = new THREE.Mesh(new THREE.ShapeGeometry(toShape(floor.outline, cx, cy)), slabMaterial);
            slab.rotation.x = Math.PI / 2;
            group.add(slab);

            const floorLabels: CSS2DObject[] = [];
            for (const room of floor.rooms) {
                const label = room.number || room.name;
                const item = label ? itemsByKey.get(roomKey(floor.floor, MODEL_NAME_TO_TITLE[label] ?? label)) : undefined;
                const isRoom = room.kind === "room" || Boolean(item);
                const height = isRoom ? ROOM_HEIGHT : 1;
                const base = isRoom ? COLOR.room : COLOR.space;

                const geometry = new THREE.ExtrudeGeometry(toShape(room.polygon, cx, cy), { depth: height, bevelEnabled: false });
                const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: base }));
                mesh.rotation.x = Math.PI / 2;
                mesh.position.y = height + 0.2;
                group.add(mesh);
                rooms.push({ mesh, item, base });

                if (item && room.number) {
                    const xs = room.polygon.map(([x]) => x), ys = room.polygon.map(([, y]) => y);
                    const tag = document.createElement("span");
                    tag.textContent = room.number;
                    tag.className = "rounded bg-background/80 px-1 text-[10px] font-medium text-foreground";
                    const object = new CSS2DObject(tag);
                    object.position.set((Math.min(...xs) + Math.max(...xs)) / 2 - cx, height + 1, (Math.min(...ys) + Math.max(...ys)) / 2 - cy);
                    object.visible = false;
                    group.add(object);
                    floorLabels.push(object);
                }
            }
            labels.set(floor.floor, floorLabels);

            const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, floor.walls.length);
            const matrix = new THREE.Matrix4();
            floor.walls.forEach(([ax, ay, bx, by], index) => {
                const length = Math.hypot(bx - ax, by - ay) || 0.1;
                matrix.compose(
                    new THREE.Vector3((ax + bx) / 2 - cx, WALL_HEIGHT / 2, (ay + by) / 2 - cy),
                    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(by - ay, bx - ax)),
                    new THREE.Vector3(length, 1, 1),
                );
                walls.setMatrixAt(index, matrix);
            });
            group.add(walls);
        }

        // The building is long and narrow: the first frame is fitted to its
        // width, looking down at it from the south at about 40°.
        let framed = false;
        const resize = () => {
            const { clientWidth, clientHeight } = container;
            renderer.setSize(clientWidth, clientHeight);
            labelRenderer.setSize(clientWidth, clientHeight);
            camera.aspect = clientWidth / Math.max(clientHeight, 1);
            camera.updateProjectionMatrix();
            if (framed || !clientWidth) return;
            framed = true;
            const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
            const distance = (width / 2) / (Math.tan(halfFov) * camera.aspect) * 1.25;
            camera.position.set(0, controls.target.y + distance * 0.65, distance * 0.76);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);

        let frame = 0;
        const render = () => {
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        };
        const loop = () => {
            frame = requestAnimationFrame(loop);
            controls.update();
            render();
        };
        loop();

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const pick = (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
            raycaster.setFromCamera(pointer, camera);
            const visible = rooms.filter((room) => room.item && room.mesh.parent?.visible);
            const hit = raycaster.intersectObjects(visible.map((room) => room.mesh), false)[0];
            return hit ? visible.find((room) => room.mesh === hit.object) : undefined;
        };

        const state = { rooms, floorGroups, labels, controls, hovered: undefined as RoomMesh | undefined, render };
        sceneRef.current = state;

        const onMove = (event: PointerEvent) => {
            const room = pick(event);
            const tooltip = tooltipRef.current;
            renderer.domElement.style.cursor = room ? "pointer" : "grab";
            if (state.hovered !== room) {
                const previous = state.hovered;
                state.hovered = room;
                if (previous) previous.mesh.material.emissive.setHex(0x000000);
                if (room) room.mesh.material.emissive.setHex(0x1e3a5f);
            }
            if (!tooltip) return;
            if (!room?.item) {
                tooltip.style.display = "none";
                return;
            }
            const rect = container.getBoundingClientRect();
            tooltip.textContent = `${room.item.title} · ${room.item.floor} этаж`;
            tooltip.style.display = "block";
            tooltip.style.left = `${event.clientX - rect.left + 12}px`;
            tooltip.style.top = `${event.clientY - rect.top + 12}px`;
        };

        // A click is a press and release without dragging the camera.
        let down: { x: number; y: number } | undefined;
        const onDown = (event: PointerEvent) => (down = { x: event.clientX, y: event.clientY });
        const onUp = (event: PointerEvent) => {
            if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return;
            onSelectRef.current(pick(event)?.item?.id);
        };
        const onLeave = () => {
            if (tooltipRef.current) tooltipRef.current.style.display = "none";
        };

        renderer.domElement.addEventListener("pointermove", onMove);
        renderer.domElement.addEventListener("pointerdown", onDown);
        renderer.domElement.addEventListener("pointerup", onUp);
        renderer.domElement.addEventListener("pointerleave", onLeave);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            controls.dispose();
            renderer.domElement.removeEventListener("pointermove", onMove);
            renderer.domElement.removeEventListener("pointerdown", onDown);
            renderer.domElement.removeEventListener("pointerup", onUp);
            renderer.domElement.removeEventListener("pointerleave", onLeave);
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
                }
            });
            renderer.dispose();
            container.removeChild(renderer.domElement);
            container.removeChild(labelRenderer.domElement);
            sceneRef.current = undefined;
        };
    }, [itemsByKey]);

    // One floor shown on its own sits at ground level and gets room numbers.
    useEffect(() => {
        const state = sceneRef.current;
        if (!state) return;
        const shown = floors.length ? floors : FLOORS.map((floor) => floor.floor);
        const sorted = [...shown].sort((a, b) => a - b);
        state.floorGroups.forEach((group, floor) => {
            group.visible = shown.includes(floor);
            group.position.y = floors.length ? sorted.indexOf(floor) * FLOOR_GAP : (floor - 1) * FLOOR_GAP;
        });
        state.controls.target.y = ((sorted.length - 1) / 2) * FLOOR_GAP;
        state.labels.forEach((objects, floor) => objects.forEach((object) => (object.visible = shown.length === 1 && shown.includes(floor))));
    }, [floors, itemsByKey]);

    useEffect(() => {
        const state = sceneRef.current;
        if (!state) return;
        for (const room of state.rooms) {
            const color = !room.item
                ? room.base
                : room.item.id === selectedId
                  ? COLOR.selected
                  : highlighted.has(room.item.id)
                    ? COLOR.match
                    : room.base;
            room.mesh.material.color.setHex(color);
        }
    }, [highlighted, selectedId, itemsByKey]);

    const [webgl] = useState(() => {
        try {
            return Boolean(document.createElement("canvas").getContext("webgl2"));
        } catch {
            return false;
        }
    });
    if (!webgl) {
        return <p className="text-sm text-muted-foreground">Браузер не поддерживает WebGL — макет показать нельзя.</p>;
    }

    return (
        <div ref={containerRef} className="relative h-[70vh] min-h-105 w-full overflow-hidden rounded-xl border border-border bg-muted/20">
            <div
                ref={tooltipRef}
                className="pointer-events-none absolute z-10 hidden rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
            />
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-md bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground">
                <LegendDot color={COLOR.match} label="Подходит под фильтр" />
                <LegendDot color={COLOR.selected} label="Выбрано" />
                <span>ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг</span>
            </div>
        </div>
    );
};

const LegendDot: FC<{ color: number; label: string }> = ({ color, label }) => (
    <span className="icon-inline gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: `#${color.toString(16).padStart(6, "0")}` }} />
        {label}
    </span>
);

export default InfrastructureModel;
