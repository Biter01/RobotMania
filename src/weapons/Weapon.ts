import * as THREE from 'three'
import { Entity } from '../entities/Entity';

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

     constructor(camera: THREE.Camera, texturePath: string, cooldown: number, damage: number) {
        this.cooldownTimer = cooldown;
        this.weaponMesh = this.createWeaponMesh(texturePath)
        camera.add(this.weaponMesh)
        this.cooldown = cooldown
        this.damage = damage
     }

     abstract update(dt: number, ctx: any): void;

     private createWeaponMesh(texturePath: string): THREE.Mesh {
        const texture = new THREE.TextureLoader().load(
            texturePath
        )
            
        texture.magFilter = THREE.NearestFilter
        const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
        })
        const geometry = new THREE.PlaneGeometry(0.6, 0.5)
        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(WEAPON_POS_X, WEAPON_POS_Y, WEAPON_POS_Z)
        return mesh
    }

    public dispose(): void {
        this.weaponMesh.geometry.dispose();
        (this.weaponMesh.material as THREE.Material).dispose()
    }
}