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

This dataset was created using [LeRobot](https://github.com/huggingface/lerobot).

## Dataset Description



- **Homepage:** [More Information Needed]
- **Paper:** [More Information Needed]
- **License:** apache-2.0


- **Task Objective:** Part 1: Place the bread from the serving tray into the toaster. Part 2: After the bread is toasted, hand the toast to the human. 
- **Operational Objects:** Bread and Toaster（Purchase link: [【淘宝】7天无理由退货 https://e.tb.cn/h.60Va2WXFUDHazdQ?tk=uzwkeJCxTWW MF278 「苏泊尔DJ805烤面包机吐司机小型家用早餐机多士炉烤吐司三明治机」点击链接直接打开 或者 淘宝搜索直接打开]）.  
- **Operation Duration:** Each operation takes approximately 20 to 40 seconds.  
- **Recording Frequency:** 30 Hz.  
- **Robot Type:** 7-DOF dual-arm G1 robot.  
- **End Effector:** Three-fingered dexterous hands.  
- **Dual-Arm Operation:** Yes.  
- **Image Resolution:** 640x480.  
- **Camera Positions:** Wrist-mounted (monocular camera) + head-mounted (binocular cameras).  
- **Data Content:**  
 • Robot's current state.  
 • Robot's next action.  
 • Current camera view images.  
- **Robot Initial Posture:** The first robot state in each dataset entry.  
- **Object Placement:** Place the toaster and serving tray within the fully extended reach of the robotic arm, positioned at approximately a ​45-degree angle relative to the robot.  
- **Camera View:** Follow the guidelines in **Part 5** of [AVP Teleoperation Documentation](https://github.com/unitreerobotics/avp_teleoperate).  

- **Important Notes:**  
1. Due to the inability to precisely describe spatial positions, adjust the scene to closely match the first frame of the dataset after installing the hardware as specified in **Part 5** of [AVP Teleoperation Documentation](https://github.com/unitreerobotics/avp_teleoperate).  
2. Data collection is not completed in a single session, and variations between data entries exist. Ensure these variations are accounted for during model training.  


## Dataset Structure

[meta/info.json](meta/info.json):
```json
{
    "codebase_version": "v2.0",
    "robot_type": "Unitree_G1",
    "total_episodes": 418,
    "total_frames": 352022,
    "total_tasks": 1,
    "total_videos": 1672,
    "total_chunks": 1,
    "chunks_size": 1000,
    "fps": 30,
    "splits": {
        "train": "0:418"
    },
    "data_path": "data/chunk-{episode_chunk:03d}/episode_{episode_index:06d}.parquet",
    "video_path": "videos/chunk-{episode_chunk:03d}/{video_key}/episode_{episode_index:06d}.mp4",
    "features": {
        "observation.state": {
            "dtype": "float32",
            "shape": [
                28
            ],
            "names": [
                [
                    "kLeftShoulderPitch",
                    "kLeftShoulderRoll",
                    "kLeftShoulderYaw",
                    "kLeftElbow",
                    "kLeftWristRoll",
                    "kLeftWristPitch",
                    "kLeftWristYaw",
                    "kRightShoulderPitch",
                    "kRightShoulderRoll",
                    "kRightShoulderYaw",
                    "kRightElbow",
                    "kRightWristRoll",
                    "kRightWristPitch",
                    "kRightWristYaw",
                    "kLeftHandThumb0",
                    "kLeftHandThumb1",
                    "kLeftHandThumb2",
                    "kLeftHandMiddle0",
                    "kLeftHandMiddle1",
                    "kLeftHandIndex0",
                    "kLeftHandIndex1",
                    "kRightHandThumb0",
                    "kRightHandThumb1",
                    "kRightHandThumb2",
                    "kRightHandIndex0",
                    "kRightHandIndex1",
                    "kRightHandMiddle0",
                    "kRightHandMiddle1"
                ]
            ]
        },
        "action": {
            "dtype": "float32",
            "shape": [
                28
            ],
            "names": [
                [
                    "kLeftShoulderPitch",
                    "kLeftShoulderRoll",
                    "kLeftShoulderYaw",
                    "kLeftElbow",
                    "kLeftWristRoll",
                    "kLeftWristPitch",
                    "kLeftWristYaw",
                    "kRightShoulderPitch",
                    "kRightShoulderRoll",
                    "kRightShoulderYaw",
                    "kRightElbow",
                    "kRightWristRoll",
                    "kRightWristPitch",
                    "kRightWristYaw",
                    "kLeftHandThumb0",
                    "kLeftHandThumb1",
                    "kLeftHandThumb2",
                    "kLeftHandMiddle0",
                    "kLeftHandMiddle1",
                    "kLeftHandIndex0",
                    "kLeftHandIndex1",
                    "kRightHandThumb0",
                    "kRightHandThumb1",
                    "kRightHandThumb2",
                    "kRightHandIndex0",
                    "kRightHandIndex1",
                    "kRightHandMiddle0",
                    "kRightHandMiddle1"
                ]
            ]
        },
        "observation.images.cam_left_high": {
            "dtype": "video",
            "shape": [
                3,
                480,
                640
            ],
            "names": [
                "channels",
                "height",
                "width"
            ],
            "info": {
                "video.fps": 30.0,
                "video.height": 480,
                "video.width": 640,
                "video.channels": 3,
                "video.codec": "av1",
                "video.pix_fmt": "yuv420p",
                "video.is_depth_map": false,
                "has_audio": false
            }
        },
        "observation.images.cam_right_high": {
            "dtype": "video",
            "shape": [
                3,
                480,
                640
            ],
            "names": [
                "channels",
                "height",
                "width"
            ],
            "info": {
                "video.fps": 30.0,
                "video.height": 480,
                "video.width": 640,
                "video.channels": 3,
                "video.codec": "av1",
                "video.pix_fmt": "yuv420p",
                "video.is_depth_map": false,
                "has_audio": false
            }
        },
        "observation.images.cam_left_wrist": {
            "dtype": "video",
            "shape": [
                3,
                480,
                640
            ],
            "names": [
                "channels",
                "height",
                "width"
            ],
            "info": {
                "video.fps": 30.0,
                "video.height": 480,
                "video.width": 640,
                "video.channels": 3,
                "video.codec": "av1",
                "video.pix_fmt": "yuv420p",
                "video.is_depth_map": false,
                "has_audio": false
            }
        },
        "observation.images.cam_right_wrist": {
            "dtype": "video",
            "shape": [
                3,
                480,
                640
            ],
            "names": [
                "channels",
                "height",
                "width"
            ],
            "info": {
                "video.fps": 30.0,
                "video.height": 480,
                "video.width": 640,
                "video.channels": 3,
                "video.codec": "av1",
                "video.pix_fmt": "yuv420p",
                "video.is_depth_map": false,
                "has_audio": false
            }
        },
        "timestamp": {
            "dtype": "float32",
            "shape": [
                1
            ],
            "names": null
        },
        "frame_index": {
            "dtype": "int64",
            "shape": [
                1
            ],
            "names": null
        },
        "episode_index": {
            "dtype": "int64",
            "shape": [
                1
            ],
            "names": null
        },
        "index": {
            "dtype": "int64",
            "shape": [
                1
            ],
            "names": null
        },
        "task_index": {
            "dtype": "int64",
            "shape": [
                1
            ],
            "names": null
        }
    }
}
```


## Citation

**BibTeX:**

```bibtex
[More Information Needed]
```