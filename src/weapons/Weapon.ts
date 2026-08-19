import * as THREE from 'three'
import { Entity } from '../entities/Entity';
import { loadPixelTexture } from '../core/AssetLoader';

// Position des Waffen-Sprites im lokalen Kamera-Raum.
// z muss kleiner als -CAMERA_NEAR sein, sonst clippt die Near-Plane das Mesh weg.
const WEAPON_POS_X: number = 0.0
const WEAPON_POS_Y: number = -0.06
const WEAPON_POS_Z: number = -0.4




export abstract class Weapon implements Entity {
     readonly cooldown: number
     readonly weaponMesh: THREE.Mesh
     public cooldownTimer: number;
     readonly damage: number;
     private disposed: boolean = false;
    readonly ready: Promise<void>


     constructor(camera: THREE.Camera, texturePath: string, cooldown: number, damage: number) {
        this.cooldownTimer = cooldown;
        const { mesh, ready } = this.createWeaponMesh(texturePath)
        this.weaponMesh = mesh
        this.ready = ready
        camera.add(this.weaponMesh)
        this.cooldown = cooldown
        this.damage = damage
     }

     abstract update(dt: number, ctx: any): void;

     private createWeaponMesh(texturePath: string): { mesh: THREE.Mesh; ready: Promise<void> } {
        const material = new THREE.MeshBasicMaterial({
            transparent: true
        })
        const geometry = new THREE.PlaneGeometry(0.6, 0.5)
        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(WEAPON_POS_X, WEAPON_POS_Y, WEAPON_POS_Z)

        const ready = loadPixelTexture(texturePath, THREE.NoColorSpace).then((texture: THREE.Texture) => {
            // Waffe kann waehrend des Ladens schon disposed sein
            if (this.disposed) {
                texture.dispose()
                return
            }
            material.map = texture
            material.needsUpdate = true
            material.transparent = true
        })

        return { mesh, ready }
    }

    public dispose(): void {
        if (this.disposed) return
        this.disposed = true

        this.weaponMesh.removeFromParent()
        this.weaponMesh.geometry.dispose()

        const material = this.weaponMesh.material as THREE.MeshBasicMaterial
        // Material.dispose() fasst die Textur nicht an
        material.map?.dispose()
        material.dispose()
    }
}