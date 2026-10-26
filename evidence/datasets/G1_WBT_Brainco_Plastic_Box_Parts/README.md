---
license: apache-2.0
task_categories:
  - robotics

tags:
  - LeRobot

configs:
  - config_name: default
    data_files: data/*/*.parquet
---

# Data Structure

Codebase `v3.0`. All cameras are AV1-encoded, 480×640×3, 30 fps.

## Video Streams (`observation.images.*`)

| Key | Description |
|-----|-------------|
| `head_stereo_left` / `head_stereo_right` | Head stereo cameras |
| `wrist_left` / `wrist_right` | Wrist cameras |

## Observations (`observation.state.*`)

| Key | Dim | Description |
|-----|-----|-------------|
| `lower_body` | 15 | Both legs (hip×3, knee, ankle×2) + waist (yaw, roll, pitch) |
| `left_arm` / `right_arm` | 7 | shoulder×3, elbow, wrist×3 |
| `left_leg` / `right_leg` | 6 | hip×3, knee, ankle×2 |
| `waist_state_joint` | 3 | yaw, roll, pitch |
| `hand_state` | 12 | Finger states, 6 per hand (see Hand Convention) |
| `left_fig6d` / `right_fig6d` | 6 | Per-finger 6D state |
| `left_ee_pose_gripper_base` / `right_ee_pose_gripper_base` | 6 | EE pose (x,y,z,roll,pitch,yaw) in base frame |
| `left_ee_pose_gripper_torso` / `right_ee_pose_gripper_torso` | 6 | EE pose in torso frame |
| `recomputed_ee_valid` | 1 | 1 if recomputed EE poses are valid |
| `state_torso` | 6 | Torso pose (x,y,z,roll,pitch,yaw) |
| `state_d435` | 6 | D435 camera pose |
| `state_base_pose` | 7 | Base pose (x,y,z,qx,qy,qz,qw) |
| `state_base_rot` | 6 | Gravity vector + angular velocity (gx,gy,gz,wx,wy,wz) |
| `state_base_rot_quat` | 4 | Base orientation (qx,qy,qz,qw) |

## Actions (`action.*`)

| Key | Dim | Description |
|-----|-----|-------------|
| `lower_body` | 15 | Both legs + waist |
| `left_arm` / `right_arm` | 7 | shoulder×3, elbow, wrist×3 |
| `left_leg` / `right_leg` | 6 | hip×3, knee, ankle×2 |
| `waist_action_joint` | 3 | yaw, roll, pitch |
| `hand_cmd` | 12 | Finger commands, 6 per hand (see Hand Convention) |
| `left_fig6d` / `right_fig6d` | 6 | Per-finger 6D command |
| `left_ee_pose_gripper_base` / `right_ee_pose_gripper_base` | 6 | Target EE pose in base frame |
| `left_ee_pose_gripper_torso` / `right_ee_pose_gripper_torso` | 6 | Target EE pose in torso frame |
| `action_torso` | 6 | Target torso pose |
| `action_d435` | 6 | Target D435 pose |
| `action_base_pose` | 7 | Target base pose (x,y,z,qx,qy,qz,qw) |
| `action_base_rot` | 4 | Target base orientation (qx,qy,qz,qw) |
| `base_command` | 4 | vx, vy, angle_z, height |

## Bookkeeping

`timestamp`, `frame_index`, `episode_index`, `index`, `task_index`.

---

# Hand Convention

Finger channels (`hand_state` / `hand_cmd`, 6 per hand) depend on the hand type.

### Inspire Hand (range 0.0 – 1.0, open → close)
1. Index finger
2. Middle finger
3. Ring finger
4. Little finger
5. Thumb (open/close)
6. Thumb (lateral tilt)

### BrainCo Hand (range 0.0 – 1.0, open → close)
1. Thumb (open/close)
2. Thumb (lateral tilt)
3. Index finger
4. Middle finger
5. Ring finger
6. Little finger

### Dex1 Hand (range 5.5 – 0.0, open → close)
1. Open/close

---

# Acknowledgements

This dataset was created using the [LeRobot](https://github.com/huggingface/lerobot) framework.
