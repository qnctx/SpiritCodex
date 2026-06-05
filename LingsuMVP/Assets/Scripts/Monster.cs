using System.Collections;
using UnityEngine;

namespace LingsuMVP
{
    public class Monster : MonoBehaviour
    {
        [Header("Monster Attributes")]
        public int hp = 30;
        public int maxHp = 30;
        public int attack = 5;
        public int defense = 2;
        public bool isBoss = false;

        private BattleManager _battleManager;
        private bool _isDead = false;
        private bool _deathComplete = false;
        private Vector3 _initialScale;
        private Coroutine _deathRoutine;
        private Coroutine _burnRoutine;
        private GameObject _burnMarker;
        private int _initialHp;
        private int _initialAttack;
        private int _initialDefense;
        private int _baseHp;
        private int _baseAttack;
        private int _baseDefense;
        private static Sprite _burnMarkerSprite;

        public bool IsAlive
        {
            get { return !_isDead && gameObject.activeSelf; }
        }

        public bool IsCleared
        {
            get { return !gameObject.activeSelf || _deathComplete; }
        }

        public void Initialize(BattleManager battleManager, bool boss = false)
        {
            _battleManager = battleManager;
            isBoss = boss;
            _isDead = false;
            _deathComplete = false;
            _initialScale = transform.localScale;

            maxHp = hp;
            _baseHp = hp;
            _baseAttack = attack;
            _baseDefense = defense;
            SetInitialStats(hp, attack, defense);
        }

        public void ApplyStageScale(int stageIndex)
        {
            int stage = Mathf.Max(1, stageIndex);
            float hpScale = 1f + (stage - 1) * 0.25f;
            float attackScale = 1f + (stage - 1) * 0.15f;
            int scaledHp = Mathf.Max(1, Mathf.RoundToInt(_baseHp * hpScale));
            int scaledAttack = Mathf.Max(1, Mathf.RoundToInt(_baseAttack * attackScale));
            SetInitialStats(scaledHp, scaledAttack, _baseDefense);
        }

        private void SetInitialStats(int newHp, int newAttack, int newDefense)
        {
            _initialHp = newHp;
            _initialAttack = newAttack;
            _initialDefense = newDefense;
        }

        public int TakeDamage(int damage)
        {
            if (_isDead) return 0;

            int actualDamage = Mathf.Max(1, damage - defense);
            hp -= actualDamage;
            hp = Mathf.Max(0, hp);

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} took {actualDamage} damage. HP: {hp}/{maxHp}");

            if (hp <= 0)
            {
                Die();
            }

            return actualDamage;
        }

        public void Attack(Hero target)
        {
            if (target != null && !_isDead)
            {
                int damage = attack;
                CombatFeedback.PlayBasicAttack(
                    this,
                    transform,
                    target.transform,
                    damage,
                    new Color(0.95f, 0.12f, 0.75f, 1f),
                    () => target.TakeDamage(damage));
                Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} attacks Hero for {damage} damage!");
            }
        }

        public int TakeRawDamage(int damage, string source)
        {
            if (_isDead) return 0;

            int actualDamage = Mathf.Max(1, damage);
            hp -= actualDamage;
            hp = Mathf.Max(0, hp);

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} took {actualDamage} {source} damage. HP: {hp}/{maxHp}");

            if (hp <= 0)
            {
                Die();
            }

            return actualDamage;
        }

        public void ApplyBurn(int damagePerTick, int tickCount, float tickInterval)
        {
            if (_isDead)
            {
                return;
            }

            if (_burnRoutine != null)
            {
                StopCoroutine(_burnRoutine);
            }

            _burnRoutine = StartCoroutine(BurnRoutine(damagePerTick, tickCount, tickInterval));
        }

        private IEnumerator BurnRoutine(int damagePerTick, int tickCount, float tickInterval)
        {
            SpriteRenderer renderer = GetComponent<SpriteRenderer>();
            Color originalColor = renderer != null ? renderer.color : Color.white;
            Color burnColor = new Color(1f, 0.42f, 0.05f, 1f);

            SetBurnMarkerVisible(true);

            for (int i = 0; i < tickCount; i++)
            {
                yield return new WaitForSeconds(i == 0 ? 0.25f : tickInterval);

                if (_isDead || !IsBattlePlaying())
                {
                    break;
                }

                if (renderer != null)
                {
                    renderer.color = new Color(1f, 0.46f, 0.08f, originalColor.a);
                }

                int actualDamage = TakeRawDamage(damagePerTick, "burn");
                CombatFeedback.ShowDamageNumber(transform, actualDamage, new Vector3(0f, 1.24f, 0f), burnColor);
                Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} burns for {actualDamage} damage!");

                yield return new WaitForSeconds(0.08f);

                if (!_isDead && renderer != null)
                {
                    renderer.color = originalColor;
                }
            }

            if (!_isDead && renderer != null)
            {
                renderer.color = originalColor;
            }

            SetBurnMarkerVisible(false);
            _burnRoutine = null;
        }

        private static bool IsBattlePlaying()
        {
            return GameManager.Instance == null || GameManager.Instance.CurrentState == GameManager.GameState.Playing;
        }

        private void SetBurnMarkerVisible(bool visible)
        {
            if (!visible)
            {
                if (_burnMarker != null)
                {
                    _burnMarker.SetActive(false);
                }

                return;
            }

            if (_burnMarker == null)
            {
                _burnMarker = new GameObject("BurnStatusMarker");
                _burnMarker.transform.SetParent(transform, false);
                _burnMarker.transform.localPosition = new Vector3(0f, 1.18f, 0f);
                _burnMarker.transform.localScale = new Vector3(0.22f, 0.22f, 1f);

                SpriteRenderer markerRenderer = _burnMarker.AddComponent<SpriteRenderer>();
                markerRenderer.sprite = GetBurnMarkerSprite();
                markerRenderer.color = new Color(1f, 0.3f, 0.02f, 0.95f);
                markerRenderer.sortingOrder = 75;
            }

            _burnMarker.SetActive(true);
        }

        private static Sprite GetBurnMarkerSprite()
        {
            if (_burnMarkerSprite != null)
            {
                return _burnMarkerSprite;
            }

            Texture2D texture = new Texture2D(16, 16, TextureFormat.RGBA32, false);
            Color clear = new Color(0f, 0f, 0f, 0f);
            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float dx = (x - 7.5f) / 7.5f;
                    float dy = (y - 7.5f) / 7.5f;
                    bool inCore = dx * dx + dy * dy <= 0.7f;
                    bool inTip = Mathf.Abs(dx) < 0.35f && dy > -0.95f && dy < 0.1f;
                    texture.SetPixel(x, y, inCore || inTip ? Color.white : clear);
                }
            }

            texture.Apply();
            _burnMarkerSprite = Sprite.Create(texture, new Rect(0f, 0f, 16f, 16f), new Vector2(0.5f, 0.5f), 16f);
            return _burnMarkerSprite;
        }

        private void Die()
        {
            if (_isDead) return;
            _isDead = true;

            if (_burnRoutine != null)
            {
                StopCoroutine(_burnRoutine);
                _burnRoutine = null;
            }
            SetBurnMarkerVisible(false);

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} died!");
            _deathRoutine = StartCoroutine(DeathRoutine());
        }

        private IEnumerator DeathRoutine()
        {
            SpriteRenderer renderer = GetComponent<SpriteRenderer>();
            Color originalColor = renderer != null ? renderer.color : Color.white;
            Vector3 startScale = transform.localScale;
            float duration = 0.34f;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float ratio = Mathf.Clamp01(elapsed / duration);
                float pulse = ratio < 0.35f ? 1f + ratio * 0.35f : Mathf.Lerp(1.12f, 0.1f, ratio);

                transform.localScale = startScale * pulse;
                if (renderer != null)
                {
                    float alpha = 1f - ratio;
                    renderer.color = new Color(1f, Mathf.Lerp(1f, 0.25f, ratio), Mathf.Lerp(1f, 0.25f, ratio), alpha);
                }

                yield return null;
            }

            if (renderer != null)
            {
                renderer.color = originalColor;
            }

            _deathComplete = true;
            if (_battleManager != null)
            {
                _battleManager.OnMonsterDead(this, isBoss);
            }

            gameObject.SetActive(false);
        }

        public void ResetMonster()
        {
            if (_deathRoutine != null)
            {
                StopCoroutine(_deathRoutine);
                _deathRoutine = null;
            }

            if (_burnRoutine != null)
            {
                StopCoroutine(_burnRoutine);
                _burnRoutine = null;
            }
            SetBurnMarkerVisible(false);

            _isDead = false;
            _deathComplete = false;
            hp = _initialHp;
            maxHp = _initialHp;
            attack = _initialAttack;
            defense = _initialDefense;
            transform.localScale = _initialScale;
            SpriteRenderer renderer = GetComponent<SpriteRenderer>();
            if (renderer != null)
            {
                renderer.color = Color.white;
            }
            gameObject.SetActive(true);
        }
    }
}
