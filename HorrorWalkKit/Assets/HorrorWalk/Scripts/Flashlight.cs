using System.Collections;
using UnityEngine;

namespace HorrorWalk
{
    [RequireComponent(typeof(Light))]
    public sealed class Flashlight : MonoBehaviour
    {
        public KeyCode toggleKey = KeyCode.F;
        public float flickerIntensityMin = 0.2f;
        public float flickerIntensityMax = 1.2f;

        private Light _light;
        private float _baseIntensity;
        private Coroutine _flickerRoutine;

        private void Awake()
        {
            _light = GetComponent<Light>();
            _baseIntensity = _light.intensity;
        }

        private void Update()
        {
            var gm = GameManager.Instance;
            if (gm != null && !gm.InputEnabled) return;

            if (Input.GetKeyDown(toggleKey))
            {
                _light.enabled = !_light.enabled;
            }
        }

        public void Flicker(float seconds)
        {
            if (_flickerRoutine != null) StopCoroutine(_flickerRoutine);
            _flickerRoutine = StartCoroutine(FlickerRoutine(seconds));
        }

        private IEnumerator FlickerRoutine(float seconds)
        {
            var end = Time.time + Mathf.Max(0f, seconds);
            while (Time.time < end)
            {
                if (_light.enabled)
                {
                    _light.intensity = _baseIntensity * Random.Range(flickerIntensityMin, flickerIntensityMax);
                }
                yield return new WaitForSeconds(Random.Range(0.03f, 0.12f));
            }

            _light.intensity = _baseIntensity;
            _flickerRoutine = null;
        }
    }
}

