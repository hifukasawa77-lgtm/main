using UnityEngine;

namespace HorrorWalk
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("Move")]
        public float walkSpeed = 3.5f;
        public float runSpeed = 6.0f;
        public float gravity = -18f;

        [Header("Look")]
        public Transform cameraPivot;
        public float mouseSensitivity = 2.0f;
        public float pitchMin = -80f;
        public float pitchMax = 80f;

        [Header("Keys")]
        public KeyCode runKey = KeyCode.LeftShift;

        private CharacterController _controller;
        private float _verticalVelocity;
        private float _pitch;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
            if (cameraPivot == null)
            {
                var cam = GetComponentInChildren<Camera>();
                if (cam != null) cameraPivot = cam.transform;
            }
        }

        private void OnEnable()
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        private void OnDisable()
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        private void Update()
        {
            var gm = GameManager.Instance;
            if (gm != null && !gm.InputEnabled)
            {
                _controller.Move(Vector3.zero);
                return;
            }

            Look();
            Move();
        }

        private void Look()
        {
            var mx = Input.GetAxis("Mouse X") * mouseSensitivity;
            var my = Input.GetAxis("Mouse Y") * mouseSensitivity;

            transform.Rotate(Vector3.up, mx, Space.Self);

            _pitch = Mathf.Clamp(_pitch - my, pitchMin, pitchMax);
            if (cameraPivot != null)
            {
                cameraPivot.localRotation = Quaternion.Euler(_pitch, 0f, 0f);
            }
        }

        private void Move()
        {
            var x = Input.GetAxisRaw("Horizontal");
            var z = Input.GetAxisRaw("Vertical");

            var move = (transform.right * x + transform.forward * z).normalized;
            var speed = Input.GetKey(runKey) ? runSpeed : walkSpeed;

            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = -2f;
            }

            _verticalVelocity += gravity * Time.deltaTime;

            var velocity = move * speed;
            velocity.y = _verticalVelocity;
            _controller.Move(velocity * Time.deltaTime);
        }
    }
}

