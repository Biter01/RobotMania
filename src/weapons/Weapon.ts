import * as THREE from 'three'
import { Entity } from '../entities/Entity';
import { loadPixelTexture } from '../core/AssetLoader';

// Position of the weapon sprite in local camera space.
// z must be smaller than -CAMERA_NEAR, otherwise the near plane clips the mesh.
const WEAPON_POS_X: number = 0.0
const WEAPON_POS_Y: number = -0.06
const WEAPON_POS_Z: number = -0.4

/**
 * Base class of weapons: a textured sprite attached to the camera, plus a cooldown.
 * Subclasses implement firing in {@link update}.
 */
export abstract class Weapon implements Entity {
     readonly cooldown: number
     readonly weaponMesh: THREE.Mesh
     public cooldownTimer: number;
     readonly damage: number;
     private disposed: boolean = false;
    /** Resolves once the weapon texture is loaded. */
    readonly ready: Promise<void>

     /**
      * @param camera - Camera the weapon sprite is attached to.
      * @param texturePath - Image of the weapon.
      * @param cooldown - Seconds between two shots.
      * @param damage - Damage per hit.
      */
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
            transparent: true,
            depthTest: false,
            depthWrite: false
        })
        const geometry = new THREE.PlaneGeometry(0.6, 0.5)
        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(WEAPON_POS_X, WEAPON_POS_Y, WEAPON_POS_Z)
        
        mesh.renderOrder = 999
        
        const ready = loadPixelTexture(texturePath, THREE.NoColorSpace).then((texture: THREE.Texture) => {
            // The weapon may already be disposed while loading
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
        // Material.dispose() does not touch the texture
        material.map?.dispose()
        material.dispose()
    }

    public getPosition(): THREE.Vector3 {
        return this.weaponMesh.getWorldPosition(new THREE.Vector3())
    }
}