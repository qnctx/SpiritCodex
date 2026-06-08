using UnityEngine;

namespace LingsuMVP
{
    public class Hero : MonoBehaviour
    {
        [Header("Hero Attributes")]
        public int hp = 100;
        public int maxHp = 100;
        public int attack = 10;
        public int defense = 5;

        private BattleManager _battleManager;
        private int _initialHp;
        private int _initialAttack;
        private int _initialDefense;

        public void Initialize(BattleManager battleManager)
        {
            _battleManager = battleManager;
            maxHp = hp;
            _initialHp = hp;
            _initialAttack = attack;
            _initialDefense = defense;
        }

        public int TakeDamage(int damage)
        {
            int actualDamage = Mathf.Max(1, damage - defense);
            hp -= actualDamage;
            hp = Mathf.Max(0, hp);

            Debug.Log($"Hero took {actualDamage} damage. HP: {hp}/{maxHp}");

            if (hp <= 0)
            {
                Die();
            }

            return actualDamage;
        }

        public void Attack(Monster target)
        {
            if (target != null && target.gameObject.activeSelf)
            {
                int damage = attack;
                CombatFeedback.PlayBasicAttack(
                    this,
                    transform,
                    target.transform,
                    damage,
                    new Color(1f, 0.42f, 0.12f, 1f),
                    () => target.TakeDamage(damage));
                Debug.Log($"Hero attacks Monster for {damage} damage!");
            }
        }

        public void Heal()
        {
            hp = maxHp;
        }

        public int Heal(int amount)
        {
            if (amount <= 0)
            {
                return 0;
            }

            int before = hp;
            hp = Mathf.Min(maxHp, hp + amount);
            return hp - before;
        }

        private void Die()
        {
            Debug.Log("Hero died!");
            if (_battleManager != null)
            {
                _battleManager.OnHeroDead();
            }
        }

        public void ResetStats()
        {
            hp = _initialHp;
            maxHp = _initialHp;
            attack = _initialAttack;
            defense = _initialDefense;
        }

        public void ApplyLevelStats(int level)
        {
            int bonusLevel = Mathf.Max(0, level - 1);
            maxHp = _initialHp + bonusLevel * 10;
            hp = maxHp;
            attack = _initialAttack + bonusLevel * 2;
            defense = _initialDefense + bonusLevel;
        }
    }
}
